import { layout, NODE_H, visibleNodes, type MindNode } from './mindmap';

const esc = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PAD = 24;

/** The map as a stand-alone SVG picture. Text is escaped, so an idea can never put markup in the file. `colors` are the page's own colours. */
export function toSvg(nodes: readonly MindNode[], colors: { ink: string; paper: string; line: string; accent: string }): { svg: string; width: number; height: number } {
  const boxes = layout(nodes);
  const shown = visibleNodes(nodes);
  const all = [...boxes.values()];
  const width = Math.max(...all.map(b => b.x + b.w), 0) + PAD * 2;
  const height = Math.max(...all.map(b => b.y + b.h), 0) + PAD * 2;
  const parts: string[] = [];
  for (const n of shown) {
    const box = boxes.get(n.id); const parent = n.parentId === null ? undefined : boxes.get(n.parentId);
    if (!box || !parent) continue;
    const x1 = parent.x + parent.w + PAD, y1 = parent.y + NODE_H / 2 + PAD, x2 = box.x + PAD, y2 = box.y + NODE_H / 2 + PAD;
    parts.push(`<path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}" fill="none" stroke="${esc(colors.line)}" stroke-width="2"/>`);
  }
  for (const n of shown) {
    const box = boxes.get(n.id);
    if (!box) continue;
    const stroke = n.color ?? (n.parentId === null ? colors.accent : colors.line);
    parts.push(`<rect x="${box.x + PAD}" y="${box.y + PAD}" width="${box.w}" height="${box.h}" rx="6" fill="${esc(colors.paper)}" stroke="${esc(stroke)}" stroke-width="2"/>`);
    parts.push(`<text x="${box.x + PAD + 12}" y="${box.y + PAD + NODE_H / 2 + 4}" font-family="sans-serif" font-size="13" fill="${esc(colors.ink)}">${esc(n.text.slice(0, Math.floor((box.w - 20) / 7)))}</text>`);
  }
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
