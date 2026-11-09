import type { CSSProperties } from 'react';

export interface PanelPosition { top?: number; bottom?: number; left: number; maxHeight: number }

/** The options whose name contains the typed text, ignoring case and spaces around it; all of them when nothing is typed. */
export function narrowOptions<T extends { label: string }>(options: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
}

/** The inline style of the floating list: fixed at the placed position, hidden until it has one, growing from the side it opens toward. */
export function panelStyle(pos: PanelPosition | null): CSSProperties {
  return {
    position: 'fixed', top: pos?.top, bottom: pos?.bottom, left: pos?.left ?? 0, maxHeight: pos?.maxHeight, zIndex: 300,
    visibility: pos ? 'visible' : 'hidden', transformOrigin: pos?.bottom !== undefined ? 'bottom left' : 'top left',
  };
}
