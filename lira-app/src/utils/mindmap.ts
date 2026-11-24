/** One idea in a mind map. The first node (no parent) is the central idea. */
export interface MindNode { id: string; parentId: string | null; text: string; collapsed?: boolean; color?: string; note?: string; ticketKey?: string }
export interface MindMap { id: string; name: string; nodes: MindNode[]; createdAt: string; updatedAt: string; createdBy?: string }
export interface Box { x: number; y: number; w: number; h: number }

export const NODE_H = 34;
const X_GAP = 56;
const Y_GAP = 12;
export const MAX_NODES = 2000;

export const rootOf = (nodes: readonly MindNode[]): MindNode | undefined => nodes.find(n => n.parentId === null);
export const childrenOf = (nodes: readonly MindNode[], id: string): MindNode[] => nodes.filter(n => n.parentId === id);

/** The node and everything under it. */
export function subtreeIds(nodes: readonly MindNode[], id: string): Set<string> {
  const out = new Set<string>([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of nodes) if (n.parentId !== null && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; }
  }
  return out;
}

export function newMap(id: string, name: string, now: string, rootId: string, createdBy?: string): MindMap {
  return { id, name, nodes: [{ id: rootId, parentId: null, text: name }], createdAt: now, updatedAt: now, ...(createdBy ? { createdBy } : {}) };
}

/** A new idea under `parentId` (which is opened if it was folded). The map stops growing at MAX_NODES. */
export function addChild(nodes: readonly MindNode[], parentId: string, id: string, text = 'New idea'): MindNode[] {
  if (nodes.length >= MAX_NODES || !nodes.some(n => n.id === parentId)) return [...nodes];
  return [...nodes.map(n => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n)), { id, parentId, text }];
}

/** A new idea next to `id`, straight after it among its brothers and sisters. The central idea has no sibling. */
export function addSibling(nodes: readonly MindNode[], id: string, newId: string, text = 'New idea'): MindNode[] {
  const at = nodes.find(n => n.id === id);
  if (!at || at.parentId === null || nodes.length >= MAX_NODES) return [...nodes];
  const out = [...nodes];
  out.splice(out.indexOf(at) + 1, 0, { id: newId, parentId: at.parentId, text });
  return out;
}

/** Removes the idea and everything under it. The central idea cannot be removed. */
export function removeNode(nodes: readonly MindNode[], id: string): MindNode[] {
  const at = nodes.find(n => n.id === id);
  if (!at || at.parentId === null) return [...nodes];
  const gone = subtreeIds(nodes, id);
  return nodes.filter(n => !gone.has(n.id));
}

export const updateNode = (nodes: readonly MindNode[], id: string, patch: Partial<Omit<MindNode, 'id' | 'parentId'>>): MindNode[] =>
  nodes.map(n => (n.id === id ? { ...n, ...patch } : n));

/** Moves an idea, with its branch, under another. Refused (nothing changes) for the central idea, the same parent, or a place inside its own branch. */
export function moveNode(nodes: readonly MindNode[], id: string, parentId: string): MindNode[] {
  const at = nodes.find(n => n.id === id);
  if (!at || at.parentId === null || at.parentId === parentId || subtreeIds(nodes, id).has(parentId) || !nodes.some(n => n.id === parentId)) return [...nodes];
  return [...nodes.filter(n => n.id !== id), { ...at, parentId }].map(n => (n.id === parentId && n.collapsed ? { ...n, collapsed: false } : n));
}

/** Every idea that is not hidden under a folded one. */
export function visibleNodes(nodes: readonly MindNode[]): MindNode[] {
  const hidden = new Set<string>();
  for (const n of nodes) if (n.collapsed) for (const id of subtreeIds(nodes, n.id)) if (id !== n.id) hidden.add(id);
  return nodes.filter(n => !hidden.has(n.id));
}

export const setAllCollapsed = (nodes: readonly MindNode[], collapsed: boolean): MindNode[] =>
  nodes.map(n => (n.parentId !== null && childrenOf(nodes, n.id).length > 0 ? { ...n, collapsed } : n));

export const widthOf = (text: string): number => Math.min(260, Math.max(96, text.length * 7 + 32));

/**
 * Places the visible ideas: the central idea on the left, each level a column to its right, and every idea centred on its own branch,
 * so branches never overlap whatever their size.
 */
export function layout(nodes: readonly MindNode[]): Map<string, Box> {
  const shown = visibleNodes(nodes);
  const kids = new Map<string, MindNode[]>();
  for (const n of shown) if (n.parentId !== null) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const height = new Map<string, number>();
  const measure = (n: MindNode): number => {
    const list = kids.get(n.id) ?? [];
    const h = list.length ? list.reduce((sum, c) => sum + measure(c), 0) + Y_GAP * (list.length - 1) : NODE_H;
    height.set(n.id, Math.max(h, NODE_H));
    return height.get(n.id)!;
  };
  const boxes = new Map<string, Box>();
  const place = (n: MindNode, x: number, top: number) => {
    const w = widthOf(n.text);
    boxes.set(n.id, { x, y: top + height.get(n.id)! / 2 - NODE_H / 2, w, h: NODE_H });
    let y = top;
    for (const c of kids.get(n.id) ?? []) { place(c, x + w + X_GAP, y); y += height.get(c.id)! + Y_GAP; }
  };
  const root = shown.find(n => n.parentId === null);
  if (root) { measure(root); place(root, 0, 0); }
  return boxes;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The map as an indented Markdown list, with notes and the linked ticket after each idea. */
export function toOutline(nodes: readonly MindNode[]): string {
  const root = rootOf(nodes);
  if (!root) return '';
  const lines: string[] = [];
  const walk = (n: MindNode, depth: number) => {
    lines.push(`${'  '.repeat(depth)}- ${clean(n.text)}${n.ticketKey ? ` [${n.ticketKey}]` : ''}`);
    if (n.note) for (const line of n.note.split('\n')) lines.push(`${'  '.repeat(depth + 1)}> ${line}`);
    for (const c of childrenOf(nodes, n.id)) walk(c, depth + 1);
  };
  walk(root, 0);
  return lines.join('\n');
}

/**
 * Builds ideas from an indented list (dashes, stars, numbers or plain lines; two spaces or a tab per level). The first line becomes the
 * central idea. A line indented deeper than the one before it goes under it; one that jumps more than a level is treated as one level.
 */
export function fromOutline(text: string, nextId: () => string): MindNode[] {
  const nodes: MindNode[] = [];
  const stack: { level: number; id: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const content = clean(raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''));
    if (!content) continue;
    const level = nodes.length === 0 ? 0 : Math.max(1, Math.floor(raw.match(/^[\t ]*/)![0].replace(/\t/g, '  ').length / 2));
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const id = nextId();
    nodes.push({ id, parentId: stack.length ? stack[stack.length - 1].id : null, text: content.slice(0, 200) });
    stack.push({ level, id });
    if (nodes.length >= MAX_NODES) break;
  }
  return nodes;
}

/** The ideas whose text, note or ticket contains the words (all of them, any case). */
export function searchNodes(nodes: readonly MindNode[], query: string): Set<string> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return new Set();
  return new Set(nodes.filter(n => { const hay = `${n.text} ${n.note ?? ''} ${n.ticketKey ?? ''}`.toLowerCase(); return words.every(w => hay.includes(w)); }).map(n => n.id));
}

/** The next idea to select with an arrow: the parent, the first child, or the neighbour above or below at the same level. */
export function neighbour(nodes: readonly MindNode[], id: string, dir: 'left' | 'right' | 'up' | 'down'): string | null {
  const at = nodes.find(n => n.id === id);
  if (!at) return null;
  if (dir === 'left') return at.parentId;
  if (dir === 'right') return at.collapsed ? null : childrenOf(nodes, id)[0]?.id ?? null;
  if (at.parentId === null) return null;
  const sibs = childrenOf(nodes, at.parentId);
  return sibs[sibs.indexOf(at) + (dir === 'up' ? -1 : 1)]?.id ?? null;
}
