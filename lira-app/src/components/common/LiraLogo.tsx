const MOTION = {
  once: 'animate-logo-grow group-hover:animate-logo-grow-again', // on load, and again when the logo is hovered
  loop: 'animate-logo-grow-loop',                                // while the app is starting
  none: '',
} as const;

interface LiraLogoProps {
  className?: string;
  /** Colour of the arrow. The L takes the text colour of whatever the logo sits on. */
  accentClassName?: string;
  motion?: keyof typeof MOTION;
}

/** The Lira mark: a block L with an arrow that grows out of its corner. */
export function LiraLogo({ className = 'w-7 h-7', accentClassName = 'stroke-lira-nav-accent', motion = 'once' }: LiraLogoProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" role="img" aria-label="Lira" className={className}>
      <path d="M19 10V48H42" className="stroke-current" strokeWidth="9" />
      {/* The arrow scales up from the inner corner of the L (33,36 in the drawing) */}
      <path
        d="M33 36L48 21M37.5 20.5H48.5V31.5"
        data-logo-arrow
        className={`${accentClassName} [transform-origin:33px_36px] ${MOTION[motion]}`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
