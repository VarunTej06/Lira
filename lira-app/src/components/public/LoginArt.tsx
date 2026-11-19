/** The two pictures in the bottom corners of the log-in page, drawn flat in the theme's colours. They are decoration only. */
export function BoardArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" aria-hidden="true" className={className}>
      <rect x="20" y="205" width="260" height="16" rx="3" className="fill-app-frame" />
      <rect x="50" y="40" width="210" height="150" rx="6" className="fill-lira-surface stroke-lira-border" strokeWidth="2" />
      <rect x="50" y="40" width="210" height="22" rx="6" className="fill-lira-nav" />
      {[0, 1, 2].map(col => (
        <g key={col}>
          <rect x={62 + col * 66} y="74" width="56" height="104" rx="4" className="fill-lira-bg stroke-lira-border" />
          <rect x={66 + col * 66} y="82" width="48" height="22" rx="3" className="fill-lira-surface stroke-lira-border" />
          <rect x={66 + col * 66} y="110" width="48" height="22" rx="3" className={col === 1 ? 'fill-lira-blue' : 'fill-lira-surface stroke-lira-border'} />
          {col !== 2 && <rect x={66 + col * 66} y="138" width="48" height="22" rx="3" className="fill-lira-surface stroke-lira-border" />}
        </g>
      ))}
    </svg>
  );
}

export function BookArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" aria-hidden="true" className={className}>
      <rect x="40" y="205" width="260" height="16" rx="3" className="fill-app-frame" />
      <path d="M70 70Q130 52 160 80V190Q130 168 70 186Z" className="fill-lira-surface stroke-lira-border" strokeWidth="2" strokeLinejoin="round" />
      <path d="M250 70Q190 52 160 80V190Q190 168 250 186Z" className="fill-lira-surface stroke-lira-border" strokeWidth="2" strokeLinejoin="round" />
      {[96, 112, 128].map(y => <path key={y} d={`M86 ${y}Q112 ${y - 8} 144 ${y + 8}`} className="stroke-lira-border" strokeWidth="3" fill="none" strokeLinecap="round" />)}
      {[96, 112].map(y => <path key={y} d={`M176 ${y + 8}Q208 ${y - 8} 234 ${y}`} className="stroke-lira-border" strokeWidth="3" fill="none" strokeLinecap="round" />)}
      <rect x="180" y="128" width="50" height="34" rx="3" className="fill-logo-gold" />
      <circle cx="234" cy="64" r="30" className="fill-none stroke-lira-nav" strokeWidth="8" />
      <path d="M255 86L286 120" className="stroke-lira-nav" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
