/** The lit dots under the pointer on the black band of the landing page: how far apart the dots are, how far the light reaches, and how bright each one is. */
export const DOT_GAP = 22;
export const GLOW_RADIUS = 130;
export const BASE_ALPHA = 0.1;
export const PEAK_ALPHA = 0.9;

/** 0 far from the pointer, 1 right at it, falling off smoothly in between. */
export function dotLight(distance: number, radius: number = GLOW_RADIUS): number {
  if (!(distance < radius)) return 0;
  const t = 1 - Math.max(0, distance) / radius;
  return t * t;
}

/** The brightness of a dot: the faint resting level, plus the light from the pointer. With no pointer on the band, every dot rests. */
export function dotAlpha(dotX: number, dotY: number, pointer: { x: number; y: number } | null): number {
  if (!pointer) return BASE_ALPHA;
  return BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * dotLight(Math.hypot(dotX - pointer.x, dotY - pointer.y));
}

/** How many columns and rows of dots fit an area. */
export function dotGrid(width: number, height: number, gap: number = DOT_GAP): { cols: number; rows: number } {
  return { cols: Math.max(0, Math.floor(width / gap) + 1), rows: Math.max(0, Math.floor(height / gap) + 1) };
}
