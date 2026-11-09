export interface PanelPos { top?: number; bottom?: number; left: number; maxHeight: number }

/**
 * Where the list goes: under the button when the whole list fits there, otherwise on the side with more room,
 * and never taller than that room, so every value can be reached by scrolling the list itself.
 */
export function placePanel(anchor: { left: number; top: number; bottom: number }, width: number, listHeight: number, view: { width: number; height: number }): PanelPos {
  const margin = 8;
  const left = Math.min(Math.max(margin, anchor.left), view.width - width - margin);
  const below = view.height - anchor.bottom - 6 - margin;
  const above = anchor.top - 6 - margin;
  const down = Math.min(listHeight, 360) <= below || below >= above;
  return down
    ? { top: anchor.bottom + 6, left, maxHeight: Math.max(120, Math.min(360, below)) }
    : { bottom: view.height - anchor.top + 6, left, maxHeight: Math.max(120, Math.min(360, above)) };
}

/** Where the calendar goes: under the field, or above it when there is no room below, and always inside the window. */
export function placeCalendar(anchor: { left: number; top: number; bottom: number }, panel: { width: number; height: number }, view: { width: number; height: number }): { top: number; left: number } {
  const margin = 8;
  let top = anchor.bottom + 6;
  if (top + panel.height > view.height - margin) top = Math.max(margin, anchor.top - 6 - panel.height);
  const left = Math.min(Math.max(margin, anchor.left), view.width - panel.width - margin);
  return { top, left };
}

/** Where a "..." menu goes: under its button and right-aligned to it, above the button when there is no room below, and always inside the window. */
export function placeMenu(anchor: { top: number; bottom: number; right: number }, menu: { width: number; height: number }, view: { width: number; height: number }): { top: number; left: number } {
  const gap = 4;
  const margin = 8;
  let top = anchor.bottom + gap;
  if (top + menu.height > view.height - margin) top = Math.max(margin, anchor.top - gap - menu.height);
  const left = Math.min(Math.max(margin, anchor.right - menu.width), view.width - menu.width - margin);
  return { top, left };
}
