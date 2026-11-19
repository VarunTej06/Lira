/**
 * The two scenes at the bottom corners of the log-in page, drawn flat in the theme's own colours: a work board on the left, a
 * place of learning on the right. They are decoration only (hidden from screen readers), and light mode (Sorrel) and dark mode
 * (Pace) each get their own palette from the same classes.
 */
const LINE = 'fill-lira-border';

function Ticket({ x, y, tone }: { x: number; y: number; tone: 'plain' | 'accent' | 'done' }) {
  const body = tone === 'accent' ? 'fill-lira-blue' : tone === 'done' ? 'fill-lira-green-light stroke-lira-border' : 'fill-lira-surface stroke-lira-border';
  const line = tone === 'accent' ? 'fill-lira-on-blue' : LINE;
  return (
    <g>
      <rect x={x} y={y} width="62" height="32" rx="5" className={body} strokeWidth="1.5" />
      <rect x={x + 8} y={y + 9} width="34" height="4" rx="2" className={line} />
      <rect x={x + 8} y={y + 18} width="22" height="4" rx="2" className={line} opacity={tone === 'accent' ? 0.7 : 1} />
      {tone === 'done'
        ? <path d={`M${x + 46} ${y + 10} l4 4 l8 -9`} className="stroke-lira-muted" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        : <rect x={x + 46} y={y + 8} width="10" height="7" rx="3" className={tone === 'accent' ? 'fill-logo-gold' : 'fill-lira-teal-light'} />}
    </g>
  );
}

export function BoardArt({ className = '' }: { className?: string }) {
  const columns = [{ x: 72, tickets: ['plain', 'plain', 'plain'] }, { x: 152, tickets: ['plain', 'accent', 'plain'] }, { x: 232, tickets: ['done', 'done'] }] as const;
  return (
    <svg viewBox="0 0 400 292" aria-hidden="true" className={`${className} overflow-visible`}>
      <path d="M-90 292V140a190 190 0 0 1 380 0v152z" className="fill-lira-blue-light" />
      <rect x="40" y="282" width="320" height="10" rx="3" className="fill-lira-muted" />

      {/* the board */}
      <rect x="60" y="40" width="254" height="244" rx="8" className="fill-lira-surface stroke-lira-border" strokeWidth="2" />
      <path d="M60 68V48a8 8 0 0 1 8-8h238a8 8 0 0 1 8 8v20z" className="fill-lira-muted" />
      <rect x="76" y="51" width="70" height="7" rx="3.5" className="fill-lira-bg" opacity="0.9" />
      <rect x="270" y="50" width="28" height="9" rx="4.5" className="fill-logo-gold" />
      {[76, 126, 176].map((x, i) => <rect key={x} x={x} y="78" width="38" height="5" rx="2.5" className={i === 0 ? 'fill-lira-text' : LINE} />)}
      <rect x="76" y="88" width="38" height="2.5" rx="1.2" className="fill-lira-blue" />
      {columns.map(col => (
        <g key={col.x}>
          <rect x={col.x} y="98" width="74" height={col.tickets.length === 3 ? 150 : 112} rx="6" className="fill-lira-bg stroke-lira-border" />
          {col.tickets.map((tone, i) => <Ticket key={i} x={col.x + 6} y={106 + i * 40} tone={tone} />)}
        </g>
      ))}

      {/* a chart card in front of the board */}
      <rect x="236" y="196" width="128" height="88" rx="8" className="fill-lira-surface stroke-lira-border" strokeWidth="2" />
      <rect x="250" y="208" width="52" height="5" rx="2.5" className={LINE} />
      <rect x="250" y="218" width="32" height="4" rx="2" className={LINE} />
      {[[252, 20], [268, 32], [284, 24], [300, 46], [316, 36], [332, 52]].map(([x, h], i) => (
        <rect key={x} x={x} y={272 - h} width="11" height={h} rx="2.5" className={i === 5 ? 'fill-logo-gold' : 'fill-lira-muted'} />
      ))}
      <rect x="248" y="272" width="104" height="2" rx="1" className={LINE} />

      {/* a ticket chip and two avatars at the left edge of the board */}
      <rect x="8" y="124" width="86" height="28" rx="14" className="fill-lira-muted" />
      <text x="24" y="142" fontSize="11" fontWeight="700" className="fill-lira-bg">AZ-104</text>
      {[26, 48].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="176" r="15" className={i === 0 ? 'fill-logo-gold stroke-lira-surface' : 'fill-lira-teal-light stroke-lira-surface'} strokeWidth="3" />
          <circle cx={cx} cy="172" r="4.5" className="fill-lira-surface" />
          <path d={`M${cx - 8} 186a8 7 0 0 1 16 0z`} className="fill-lira-surface" />
        </g>
      ))}

      {/* a pencil on the floor, and a plant */}
      <g transform="rotate(-5 60 280)">
        <rect x="14" y="273" width="62" height="9" rx="2" className="fill-logo-gold" />
        <path d="M76 273l14 4.5-14 4.5z" className="fill-lira-amber-light" />
        <path d="M86 276l4 1.5-4 1.5z" className="fill-lira-muted" />
        <rect x="8" y="273" width="9" height="9" rx="2" className="fill-lira-blue" />
      </g>
      <path d="M366 292l4-22h20l4 22z" className="fill-logo-gold" />
      <path d="M380 270c-14-18-12-34-4-48 10 14 14 30 4 48z" className="fill-lira-muted" />
      <path d="M380 270c14-14 18-28 14-42-12 10-18 26-14 42z" className="fill-lira-green-light stroke-lira-muted" strokeWidth="1.5" />
    </svg>
  );
}

function Book({ x, y, w, tone }: { x: number; y: number; w: number; tone: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="26" rx="4" className={tone} />
      <rect x={x + 12} y={y} width="5" height="26" className="fill-lira-bg" opacity="0.35" />
      <rect x={x + 22} y={y + 11} width={w - 44} height="4" rx="2" className="fill-lira-bg" opacity="0.45" />
    </g>
  );
}

export function BookArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 292" aria-hidden="true" className={`${className} overflow-visible`}>

      <path d="M110 292V140a190 190 0 0 1 380 0v152z" className="fill-lira-blue-light" />

      {/* an arched library window */}
      <path d="M92 292V138a88 88 0 0 1 176 0v154z" className="fill-lira-muted" />
      <path d="M106 292V138a74 74 0 0 1 148 0v154z" className="fill-lira-surface" />
      <rect x="177" y="64" width="6" height="228" className="fill-lira-muted" />
      <rect x="106" y="160" width="148" height="6" className="fill-lira-muted" />
      <rect x="190" y="174" width="58" height="66" className="fill-logo-gold" opacity="0.9" />

      {/* floating papers */}
      <g transform="rotate(6 330 70)">
        <rect x="298" y="34" width="68" height="84" rx="6" className="fill-lira-surface stroke-lira-border" strokeWidth="2" />
        <rect x="310" y="48" width="36" height="5" rx="2.5" className={LINE} />
        <rect x="310" y="60" width="44" height="4" rx="2" className={LINE} />
        <rect x="310" y="70" width="40" height="4" rx="2" className={LINE} />
        <rect x="310" y="92" width="22" height="10" rx="5" className="fill-logo-gold" />
      </g>
      <g transform="rotate(-5 300 150)">
        <rect x="270" y="112" width="62" height="64" rx="6" className="fill-lira-green-light stroke-lira-border" strokeWidth="2" />
        <path d="M284 144l8 8 16-18" className="stroke-lira-muted" fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* a stack of books with an open book on top */}
      <Book x={70} y={266} w={240} tone="fill-lira-muted" />
      <Book x={86} y={240} w={206} tone="fill-logo-gold" />
      <Book x={100} y={214} w={184} tone="fill-lira-blue" />
      <path d="M192 212q-30-18-72-8v-48q42-8 72 10z" className="fill-lira-surface stroke-lira-border" strokeWidth="2" strokeLinejoin="round" />
      <path d="M192 212q30-18 72-8v-48q-42-8-72 10z" className="fill-lira-surface stroke-lira-border" strokeWidth="2" strokeLinejoin="round" />
      {[176, 188, 200].map(y => <path key={y} d={`M136 ${y - 14}q26-4 48 8`} className="stroke-lira-border" fill="none" strokeWidth="3" strokeLinecap="round" />)}
      {[176, 188].map(y => <path key={y} d={`M200 ${y - 6}q22-12 48-8`} className="stroke-lira-border" fill="none" strokeWidth="3" strokeLinecap="round" />)}

      {/* a graduation cap */}
      <path d="M232 112l62 22-62 22-62-22z" className="fill-lira-text" />
      <path d="M200 144v22q32 16 64 0v-22l-32 12z" className="fill-lira-muted" />
      <path d="M294 134v34" className="stroke-logo-gold" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="290" y="166" width="9" height="14" rx="3" className="fill-logo-gold" />

      {/* a magnifying glass */}
      <circle cx="46" cy="236" r="27" className="fill-lira-surface stroke-lira-muted" strokeWidth="8" />
      <path d="M26 258l-18 28" className="stroke-lira-muted" strokeWidth="9" strokeLinecap="round" />
      <path d="M32 226q6-10 16-10" className="stroke-lira-surface" fill="none" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
