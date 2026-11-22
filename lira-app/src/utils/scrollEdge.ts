/** Where a sideways scroller is resting, so its arrow buttons can switch themselves off at the ends. */
export type ScrollEdge = 'start' | 'middle' | 'end';

const TOLERANCE = 2; // pixels: browsers leave a fraction when a smooth scroll settles

export function scrollEdge(scrollLeft: number, clientWidth: number, scrollWidth: number): ScrollEdge {
  if (scrollWidth - clientWidth <= TOLERANCE) return 'start'; // everything fits: nothing to scroll
  if (scrollLeft <= TOLERANCE) return 'start';
  return scrollLeft + clientWidth >= scrollWidth - TOLERANCE ? 'end' : 'middle';
}
