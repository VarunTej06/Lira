const STEP = 6;

/** A small icon made of dots, drawn from rows of text: `#` is a dot, `.` is empty. */
export function DotIcon({ rows, className = 'w-14 h-14' }: { rows: readonly string[]; className?: string }) {
  const width = Math.max(...rows.map(r => r.length));
  return (
    <svg viewBox={`0 0 ${width * STEP} ${rows.length * STEP}`} aria-hidden="true" className={`${className} fill-logo-gold`}>
      {rows.flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? <circle key={`${x}-${y}`} cx={x * STEP + STEP / 2} cy={y * STEP + STEP / 2} r="2.1" /> : null)))}
    </svg>
  );
}
