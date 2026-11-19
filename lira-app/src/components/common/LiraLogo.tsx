const MOTION = {
  once: 'animate-logo-settle group-hover:animate-logo-settle-again', // on load, and again when the logo is hovered
  loop: 'animate-logo-settle-loop',                                  // while the app is starting
  none: '',
} as const;

const HEXAGON = 'M32 3L57.1 17.5V46.5L32 61L6.9 46.5V17.5Z';
// Each side of the open book: the page, the edge of the pages, and the lower leaves
const LEFT_SIDE = ['M30.4 25Q23.5 20.6 14.8 22V40.3Q23.5 39.2 30.4 44.3Z', 'M10.6 21.4H12.4V41.6H10.6Z', 'M14.8 42.9Q23.5 41.8 30.4 46.8V49Q23.5 44.2 14.8 45.3Z'];
const RIGHT_SIDE = ['M33.6 25Q40.5 20.6 49.2 22V40.3Q40.5 39.2 33.6 44.3Z', 'M51.6 21.4H53.4V41.6H51.6Z', 'M49.2 42.9Q40.5 41.8 33.6 46.8V49Q40.5 44.2 49.2 45.3Z'];

interface LiraLogoProps {
  className?: string;
  /** Colour of the book. The hexagon takes the text colour of whatever the logo sits on. */
  accentClassName?: string;
  motion?: keyof typeof MOTION;
}

/** The Liraspaces mark: a hexagon holding an open book. The left page settles first, then the right, each with a small shake. */
export function LiraLogo({ className = 'w-7 h-7', accentClassName = 'fill-logo-gold', motion = 'once' }: LiraLogoProps) {
  const side = (paths: string[], delay: string) => (
    <g data-logo-page className={`${accentClassName} motion-reduce:animate-none ${MOTION[motion]} ${motion === 'none' ? '' : delay}`}>
      {paths.map((d) => <path key={d} d={d} />)}
    </g>
  );
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Liraspaces" className={className}>
      <path d={HEXAGON} className="fill-current" />
      {side(LEFT_SIDE, '[animation-delay:0s]')}
      {side(RIGHT_SIDE, '[animation-delay:0.3s]')}
    </svg>
  );
}
