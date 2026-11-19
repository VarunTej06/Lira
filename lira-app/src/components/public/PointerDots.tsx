import { useEffect, useRef } from 'react';
import { BASE_ALPHA, DOT_GAP, dotAlpha, dotGrid } from '../../utils/dotField';

const quiet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches;

/**
 * A field of faint dots that light up under the mouse. It sits behind the content of its parent and listens to the parent's mouse.
 * With reduced motion, or on a touch screen where there is no mouse, the dots stay still and faint.
 */
export function PointerDots() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const host = el?.parentElement;
    const ctx = el?.getContext('2d');
    if (!el || !host || !ctx) return;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const draw = () => {
      frame = 0;
      const { width, height } = el;
      const scale = width / (host.clientWidth || 1);
      const { cols, rows } = dotGrid(host.clientWidth, host.clientHeight);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = getComputedStyle(el).color;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * DOT_GAP, y = r * DOT_GAP;
          ctx.globalAlpha = dotAlpha(x, y, pointer);
          ctx.beginPath();
          ctx.arc(x * scale, y * scale, 1.2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    const redraw = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(host.clientWidth * dpr));
      el.height = Math.max(1, Math.round(host.clientHeight * dpr));
      draw();
    };
    const move = (e: PointerEvent) => {
      const box = host.getBoundingClientRect();
      pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
      redraw();
    };
    const leave = () => { pointer = null; redraw(); };

    resize();
    const watcher = new ResizeObserver(resize);
    watcher.observe(host);
    if (!quiet()) { host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave); }
    return () => {
      watcher.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" data-base-alpha={BASE_ALPHA} className="absolute inset-0 w-full h-full text-white pointer-events-none" />;
}
