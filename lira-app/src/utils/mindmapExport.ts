import { boundsOf, colorOf, connector, layoutMap, strokeOf } from './mindLayout';
import { visibleNodes, type MindNode } from './mindmap';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PAD = 32;

/** The map as a stand-alone SVG picture, drawn the way it is on screen. Text is escaped, so an idea can never put markup in the file. `colors` are the page's own colours. */
export function toSvg(nodes: readonly MindNode[], colors: { ink: string; paper: string; line: string; accent: string }): { svg: string; width: number; height: number } {
  const boxes = layoutMap(nodes);
  const shown = visibleNodes(nodes);
  const bounds = boundsOf(boxes);
  const width = Math.ceil(bounds.w + PAD * 2);
  const height = Math.ceil(bounds.h + PAD * 2);
  const dx = PAD - bounds.x; const dy = PAD - bounds.y;
  const parts: string[] = [`<g transform="translate(${dx} ${dy})">`];
  for (const n of shown) {
    const box = boxes.get(n.id); const parent = n.parentId === null ? undefined : boxes.get(n.parentId);
    if (!box || !parent) continue;
    parts.push(`<path d="${connector(parent, box)}" fill="none" stroke="${esc(colorOf(nodes, n.id) ?? colors.line)}" stroke-width="${strokeOf(box.depth)}" stroke-linecap="round"/>`);
  }
  for (const n of shown) {
    const box = boxes.get(n.id);
    if (!box) continue;
    const root = box.side === 'root';
    const fit = Math.floor((box.w - 16) / (root ? 9 : 7));
    const label = esc(n.text.length > fit ? `${n.text.slice(0, Math.max(1, fit - 1))}...` : n.text);
    if (root) parts.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="12" fill="${esc(colors.paper)}" stroke="${esc(colors.accent)}" stroke-width="2"/>`);
    const x = root ? box.x + box.w / 2 : box.side === 'right' ? box.x : box.x + box.w;
    parts.push(`<text x="${x}" y="${box.y + box.h / 2 + 4}" text-anchor="${root ? 'middle' : box.side === 'right' ? 'start' : 'end'}" font-family="sans-serif" font-size="${root ? 16 : 13}" font-weight="${root || box.depth === 1 ? 600 : 400}" fill="${esc(colors.ink)}">${label}</text>`);
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
