import { buildHeader } from '../../utils/roadmapUtils';

/** The sticky top of a timeline: the corner label, the two rows of period cells and the red TODAY marker. */
export function TimelineHeader({ header, width, labelWidth, height, todayX, corner }: {
  header: ReturnType<typeof buildHeader>; width: number; labelWidth: number; height: number; todayX: number; corner: string;
}) {
  return (
    <div className="sticky top-0 z-30 flex" style={{ height }}>
      <div className="sticky left-0 z-40 bg-lira-surface border-b border-r border-lira-border flex items-end px-4 pb-2 text-2xs font-semibold uppercase tracking-wider text-lira-muted" style={{ width: labelWidth }}>
        {corner}
      </div>
      <div className="relative bg-lira-surface border-b border-lira-border" style={{ width }}>
        {header.top.map((c, i) => (
          <div key={i} className="absolute top-0 h-6 flex items-center px-2 text-2xs font-semibold text-lira-text border-r border-lira-border/70 overflow-hidden whitespace-nowrap" style={{ left: c.x, width: c.width }}>{c.label}</div>
        ))}
        {header.bottom.map((c, i) => (
          <div key={i} className="absolute top-6 h-[26px] flex items-center px-2 text-2xs text-lira-muted border-r border-t border-lira-border/60 overflow-hidden whitespace-nowrap" style={{ left: c.x, width: c.width }}>{c.label}</div>
        ))}
        <div className="absolute top-[28px] -translate-x-1/2 px-1.5 rounded bg-red-500 text-white text-4xs font-bold z-10 leading-[14px]" style={{ left: todayX }}>TODAY</div>
      </div>
    </div>
  );
}
