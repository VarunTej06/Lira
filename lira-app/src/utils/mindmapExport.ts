import { arrowHead, EMPTY_FREE, FONT_PX, freeBounds, linkEnds, wrapLines, type FreeDoc, type Item, type Shape, type TextStyle } from './mindFree';
import { boundsOf, colorOf, connector, layoutMap, strokeOf } from './mindLayout';
import { visibleNodes, type MindNode } from './mindmap';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PAD = 32;
type Colors = { ink: string; paper: string; line: string; accent: string };

const styleAttrs = (t: TextStyle): string => `${t.bold ? ' font-weight="700"' : ''}${t.italic ? ' font-style="italic"' : ''}${t.underline ? ' text-decoration="underline"' : ''}`;

/** One shape of the free-form layer as drawing: its outline, then its words broken into lines that fit. */
function shapeToSvg(s: Shape, colors: Colors): string {
  const fill = s.kind === 'text' ? 'none' : esc(s.color ?? (s.kind === 'note' ? colors.accent : colors.paper));
  const stroke = s.kind === 'text' ? 'none' : esc(colors.line);
  const outline = s.kind === 'ellipse'
    ? `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}" fill="${fill}" fill-opacity="${s.kind === 'ellipse' && s.color ? 0.25 : 1}" stroke="${stroke}" stroke-width="1.5"/>`
    : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.kind === 'note' ? 4 : 10}" fill="${fill}" fill-opacity="${s.kind === 'note' || s.color ? 0.25 : 1}" stroke="${stroke}" stroke-width="1.5"/>`;
  const px = FONT_PX[s.size ?? 'medium'];
  const lines = wrapLines(s.text, s.w - 16, px).slice(0, Math.max(1, Math.floor((s.h - 8) / (px * 1.3))));
  const top = s.y + s.h / 2 - (lines.length * px * 1.3) / 2 + px;
  const text = lines.map((l, i) => `<tspan x="${s.x + s.w / 2}" y="${top + i * px * 1.3}">${esc(l)}</tspan>`).join('');
  return `${s.kind === 'text' ? '' : outline}<text text-anchor="middle" font-family="sans-serif" font-size="${px}"${styleAttrs(s)} fill="${esc(colors.ink)}">${text}</text>`;
}

/** The lines and shapes the person drew, as part of the picture; lines first so shapes sit on top of them. */
function freeToSvg(free: FreeDoc, items: ReadonlyMap<string, Item>, colors: Colors): string[] {
  const out: string[] = [];
  for (const l of free.links) {
    const ends = linkEnds(l, items);
    if (!ends) continue;
    const colour = esc(l.color ?? colors.line);
    out.push(`<line x1="${ends.a.x}" y1="${ends.a.y}" x2="${ends.b.x}" y2="${ends.b.y}" stroke="${colour}" stroke-width="2" stroke-linecap="round"${l.dashed ? ' stroke-dasharray="6 4"' : ''}/>`);
    if (l.arrow) out.push(`<polygon points="${arrowHead(ends.a, ends.b)}" fill="${colour}"/>`);
  }
  for (const s of free.shapes) out.push(shapeToSvg(s, colors));
  return out;
}

/** The map as a stand-alone SVG picture, drawn the way it is on screen, shapes and lines included. Text is escaped, so an idea can never put markup in the file. `colors` are the page's own colours. */
export function toSvg(nodes: readonly MindNode[], colors: Colors, free: FreeDoc = EMPTY_FREE): { svg: string; width: number; height: number } {
  const boxes = layoutMap(nodes);
  const shown = visibleNodes(nodes);
  const tree = boundsOf(boxes);
  const extra = freeBounds(free.shapes);
  const x1 = extra ? Math.min(tree.x, extra.x) : tree.x; const y1 = extra ? Math.min(tree.y, extra.y) : tree.y;
  const x2 = extra ? Math.max(tree.x + tree.w, extra.x + extra.w) : tree.x + tree.w; const y2 = extra ? Math.max(tree.y + tree.h, extra.y + extra.h) : tree.y + tree.h;
  const width = Math.ceil(x2 - x1 + PAD * 2);
  const height = Math.ceil(y2 - y1 + PAD * 2);
  const parts: string[] = [`<g transform="translate(${PAD - x1} ${PAD - y1})">`];
  for (const n of shown) {
    const box = boxes.get(n.id); const parent = n.parentId === null ? undefined : boxes.get(n.parentId);
    if (!box || !parent) continue;
    parts.push(`<path d="${connector(parent, box)}" fill="none" stroke="${esc(colorOf(nodes, n.id) ?? colors.line)}" stroke-width="${strokeOf(box.depth)}" stroke-linecap="round"/>`);
  }
  const items = new Map<string, Item>([...boxes].map(([id, b]) => [id, b] as [string, Item]));
  for (const s of free.shapes) items.set(s.id, { x: s.x, y: s.y, w: s.w, h: s.h, ellipse: s.kind === 'ellipse' });
  parts.push(...freeToSvg(free, items, colors));
  for (const n of shown) {
    const box = boxes.get(n.id);
    if (!box) continue;
    const root = box.side === 'root';
    const fit = Math.floor((box.w - 16) / (root ? 9 : 7));
    const label = esc(n.text.length > fit ? `${n.text.slice(0, Math.max(1, fit - 1))}...` : n.text);
    if (root) parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="12" fill="${esc(colors.paper)}" stroke="${esc(colors.accent)}" stroke-width="2"/>`);
    const x = root ? box.x + box.w / 2 : box.side === 'right' ? box.x : box.x + box.w;
    parts.push(`<text x="${x}" y="${box.y + box.h / 2 + 4}" text-anchor="${root ? 'middle' : box.side === 'right' ? 'start' : 'end'}" font-family="sans-serif" font-size="${root ? 16 : 13}" font-weight="${n.bold || root || box.depth === 1 ? (n.bold ? 700 : 600) : 400}"${n.italic ? ' font-style="italic"' : ''}${n.underline ? ' text-decoration="underline"' : ''} fill="${esc(colors.ink)}">${label}</text>`);
  }
  parts.push('</g>');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${esc(colors.paper)}"/>${parts.join('')}</svg>`;
  return { svg, width, height };
}

/** Saves text or a blob as a file the person keeps. */
export function download(filename: string, type: string, data: string | Blob): void {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type }) : data);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** A file name from a map name: letters, digits and dashes only. */
export const fileNameOf = (name: string, ext: string): string => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'mind-map'}.${ext}`;

/** The SVG drawn onto a canvas and saved as a PNG, at double size so it stays sharp. Resolves null when the browser cannot draw it. */
export function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => resolve(blob), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
