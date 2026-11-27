import { useState, type PointerEvent } from 'react';
import type { Size } from '../../hooks/useElementSize';

/** What part of the map is on screen: how far it was dragged from the centre (x, y) and the zoom (k). */
export interface View { x: number; y: number; k: number }

export const MIN_K = 0.25;
export const MAX_K = 2.5;
const PAD = 120;
/** The strip of tools floats over the left of the drawing, so the map is centred in the space to the right of it. */
export const LEFT_INSET = 72;
const clamp = (k: number): number => Math.min(MAX_K, Math.max(MIN_K, k));

/** The zoom that fits a box of the map in a panel, never past 100 percent so a small map is not blown up. */
export function fitView(bounds: { x: number; y: number; w: number; h: number }, size: Size): View {
  if (bounds.w === 0 || size.w === 0) return { x: 0, y: 0, k: 1 };
  const k = clamp(Math.min(1, (size.w - LEFT_INSET - PAD) / bounds.w, (size.h - PAD) / bounds.h));
  return { k, x: -(bounds.x + bounds.w / 2) * k, y: -(bounds.y + bounds.h / 2) * k };
}

/** Zooms by a factor about a point of the panel, measured from its centre, so what is under the pointer stays under it. */
export function zoomView(v: View, factor: number, cx = 0, cy = 0): View {
  const k = clamp(v.k * factor);
  return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
}

/** The pan and zoom of the drawing, with the moves a person can make: drag the background, wheel, buttons, fit to screen. */
export function useMindView() {
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  function startPan(e: PointerEvent<SVGSVGElement>) {
    if (e.target !== e.currentTarget) return false;
    const from = { x: e.clientX - view.x, y: e.clientY - view.y };
    const move = (m: globalThis.PointerEvent) => setView(v => ({ ...v, x: m.clientX - from.x, y: m.clientY - from.y }));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return true;
  }
  return { view, startPan, zoomBy: (factor: number, cx?: number, cy?: number) => setView(v => zoomView(v, factor, cx, cy)), fit: (bounds: { x: number; y: number; w: number; h: number }, size: Size) => setView(fitView(bounds, size)), reset: () => setView({ x: 0, y: 0, k: 1 }) };
}
