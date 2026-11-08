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

/** A small Markdown reader for the descriptions written before the editor existed. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const flushPara = (buf: string[]) => { if (buf.length) out.push(`<p>${buf.map(inline).join('<br>')}</p>`); buf.length = 0; };
  let para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { // fenced code
      flushPara(para);
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flushPara(para); const n = Math.min(h[1].length, 3); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^>\s?/.test(line)) {
      flushPara(para);
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${q.map(inline).join('<br>')}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) { // checkbox list
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+\[[ xX]\]\s+/.test(lines[i])) {
        const m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i++])!;
        items.push(`<li data-type="taskItem" data-checked="${m[1].toLowerCase() === 'x'}"><label><input type="checkbox"${m[1].toLowerCase() === 'x' ? ' checked' : ''}><span></span></label><div><p>${inline(m[2])}</p></div></li>`);
      }
      out.push(`<ul data-type="taskList">${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(`<li><p>${inline(lines[i++].replace(/^\s*[-*]\s+/, ''))}</p></li>`);
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(`<li><p>${inline(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))}</p></li>`);
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.trim() === '') { flushPara(para); i++; continue; }
    para.push(line);
    i++;
  }
  flushPara(para);
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
