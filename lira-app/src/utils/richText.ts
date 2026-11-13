import type { Attachment } from '../types/issue';

/**
 * Ticket descriptions are rich text, stored as a small piece of HTML written by the editor (headings, bold, lists,
 * checkboxes, colours, mentions, images from attachments...). Older tickets hold Markdown, so a description is
 * converted the first time it is opened. The HTML is never put on the page directly: the editor reads it through its
 * own schema, which drops anything it does not know (scripts, event handlers, unknown tags).
 */

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** True when the stored text is already HTML from the editor (as opposed to older Markdown or plain text). */
export const isHtmlDescription = (s: string | undefined | null) => /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|div)\b/i.test(s ?? '');

function inline(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  t = t.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

/** One block read from the Markdown (a heading, a list, a quote...) and where reading continues. */
interface Block { html: string; next: number }
type BlockReader = (lines: string[], i: number) => Block | null;

const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const QUOTE = /^>\s?/;
const CHECK_ITEM = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*]\s+/;
const NUMBER_ITEM = /^\s*\d+[.)]\s+/;

/** The run of lines from `i` that all match `re`. */
function run(lines: string[], i: number, re: RegExp): string[] {
  const out: string[] = [];
  while (i + out.length < lines.length && re.test(lines[i + out.length])) out.push(lines[i + out.length]);
  return out;
}

const fencedCode: BlockReader = (lines, i) => {
  if (!FENCE.test(lines[i])) return null;
  const code: string[] = [];
  let j = i + 1;
  while (j < lines.length && !FENCE.test(lines[j])) code.push(lines[j++]);
  return { html: `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`, next: j + 1 };
};

const heading: BlockReader = (lines, i) => {
  const h = HEADING.exec(lines[i]);
  if (!h) return null;
  const n = Math.min(h[1].length, 3);
  return { html: `<h${n}>${inline(h[2])}</h${n}>`, next: i + 1 };
};

const quote: BlockReader = (lines, i) => {
  const q = run(lines, i, QUOTE);
  if (!q.length) return null;
  return { html: `<blockquote><p>${q.map(l => inline(l.replace(QUOTE, ''))).join('<br>')}</p></blockquote>`, next: i + q.length };
};

const checklist: BlockReader = (lines, i) => {
  const items = run(lines, i, CHECK_ITEM);
  if (!items.length) return null;
  const li = items.map(line => {
    const m = CHECK_ITEM.exec(line)!;
    const checked = m[1].toLowerCase() === 'x';
    return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked' : ''}><span></span></label><div><p>${inline(m[2])}</p></div></li>`;
  });
  return { html: `<ul data-type="taskList">${li.join('')}</ul>`, next: i + items.length };
};

/** A list whose items start with `marker` (bullets or numbers). */
const listReader = (marker: RegExp, tag: 'ul' | 'ol'): BlockReader => (lines, i) => {
  const items = run(lines, i, marker);
  if (!items.length) return null;
  const li = items.map(line => `<li><p>${inline(line.replace(marker, ''))}</p></li>`);
  return { html: `<${tag}>${li.join('')}</${tag}>`, next: i + items.length };
};

/** Tried in this order: a checkbox line is also a bullet line, so checklists come first. */
const READERS: BlockReader[] = [fencedCode, heading, quote, checklist, listReader(BULLET_ITEM, 'ul'), listReader(NUMBER_ITEM, 'ol')];

/** A small Markdown reader for the descriptions written before the editor existed. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };

  let i = 0;
  while (i < lines.length) {
    const block = READERS.reduce<Block | null>((found, read) => found ?? read(lines, i), null);
    if (block) { flushPara(); out.push(block.html); i = block.next; continue; }
    if (lines[i].trim() === '') flushPara();
    else para.push(lines[i]);
    i++;
  }
  flushPara();
  return out.join('');
}

/** Images that came from attachments keep only the attachment id when stored; the picture itself lives in the attachment. */
export function toStoredHtml(html: string): string {
  if (!html || html === '<p></p>') return '';
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const id = /data-attachment-id="([^"]+)"/.exec(tag)?.[1];
    return id ? tag.replace(/\ssrc="[^"]*"/i, '') : tag;
  });
}

/** What the editor should show for a stored description (Markdown is converted, attachment pictures are put back). */
export function toEditorHtml(stored: string | undefined | null, attachments: Attachment[] = []): string {
  const text = stored ?? '';
  if (!text.trim()) return '';
  const html = isHtmlDescription(text) ? text : markdownToHtml(text);
  const byId = new Map(attachments.map(a => [a.id, a]));
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const id = /data-attachment-id="([^"]+)"/.exec(tag)?.[1];
    const att = id ? byId.get(id) : undefined;
    if (!att?.dataUrl) return tag;
    return /\ssrc="/i.test(tag) ? tag : tag.replace(/<img\b/i, `<img src="${att.dataUrl}"`);
  });
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** The description as plain text, for search, the AI and suggestions. Works for HTML and for older Markdown. */
export function descriptionToText(stored: string | undefined | null): string {
  const s = stored ?? '';
  if (!isHtmlDescription(s)) return s;
  return s
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|div|blockquote|pre|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39);/g, m => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Mentioned people in a stored description (the editor writes `data-id`). */
export function mentionsIn(stored: string | undefined | null): string[] {
  const ids = new Set<string>();
  for (const m of (stored ?? '').matchAll(/data-type="mention"[^>]*data-id="([^"]+)"/g)) ids.add(m[1]);
  for (const m of (stored ?? '').matchAll(/data-id="([^"]+)"[^>]*data-type="mention"/g)) ids.add(m[1]);
  return [...ids];
}
