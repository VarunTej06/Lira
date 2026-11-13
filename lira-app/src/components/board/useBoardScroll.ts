import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react';

const EDGE_Y = 100;
const EDGE_X = 80;
const MAX_SPEED = 22;
const REACH = 60; // the pointer may be this far outside the board and still scroll it

/** How fast to scroll along one axis: 0 in the middle, faster the closer the pointer is to either edge. */
function edgeSpeed(pos: number, start: number, end: number, edge: number): number {
  if (pos < start + edge && pos >= start - REACH) return -Math.round((1 - Math.max(0, pos - start) / edge) * MAX_SPEED + 3);
  if (pos > end - edge && pos <= end + REACH) return Math.round((1 - Math.max(0, end - pos) / edge) * MAX_SPEED + 3);
  return 0;
}

/** Scrolling for the board: it scrolls itself while a card is dragged near an edge, and the background can be dragged to pan. */
export function useBoardScroll() {
  const boardRef = useRef<HTMLDivElement>(null);
  const draggingCard = useRef(false);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => {
    let frame = 0;
    let speedX = 0;
    let speedY = 0;
    const onMove = (e: MouseEvent) => {
      const board = boardRef.current;
      if (!draggingCard.current || !board) { speedX = 0; speedY = 0; return; }
      const r = board.getBoundingClientRect();
      speedY = edgeSpeed(e.clientY, r.top, r.bottom, EDGE_Y);
      speedX = edgeSpeed(e.clientX, r.left, r.right, EDGE_X);
    };
    const onUp = () => { speedX = 0; speedY = 0; };
    const step = () => {
      const board = boardRef.current;
      if (draggingCard.current && board) { board.scrollTop += speedY; board.scrollLeft += speedX; }
      frame = requestAnimationFrame(step);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    frame = requestAnimationFrame(step);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(frame);
    };
  }, []);

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    if (draggingCard.current || !board) return;
    // Pressing on a card, button, link or field must not start a pan.
    if ((e.target as HTMLElement).closest('[data-rfd-draggable-id], [data-rfd-drag-handle-draggable-id], [data-rbd-draggable-id], .shadow-card, button, a, input, textarea, [role="button"]')) return;
    panning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: board.scrollLeft, scrollTop: board.scrollTop };
  };
  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const board = boardRef.current;
    if (!panning.current || !board) return;
    board.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
    board.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
  };
  const stopPanning = () => { panning.current = false; };
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.altKey && boardRef.current) { boardRef.current.scrollLeft += e.deltaY; e.preventDefault(); }
  };

  const startDrag = useCallback(() => { draggingCard.current = true; }, []);
  const stopDrag = useCallback(() => { draggingCard.current = false; }, []);

  return {
    boardRef, startDrag, stopDrag,
    boardProps: { onMouseDown, onMouseMove, onMouseUp: stopPanning, onMouseLeave: stopPanning, onWheel },
  };
}
