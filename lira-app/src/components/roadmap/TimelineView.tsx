import { stackMilestones } from '../../utils/roadmap/milestoneLabels';
import { useElementWidth } from '../../hooks/useElementWidth';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TimelineHeader } from './TimelineHeader';
import { ChevronDown, Flag, Diamond } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  STATUS_META, buildHeader, computeRange, daysBetween, dependencyIssues, fitPpd, fmtShort,
  laneColor, layoutRows, parseDay, resizeItem, resolveItem, shiftItem, xOf,
  type Roadmap, type RoadmapItem, type Zoom,
} from '../../utils/roadmapUtils';
import { PALETTE } from '../../theme/palette';

const LABEL_W = 270;
const HEADER_H = 52;
const MILESTONE_TIER_H = 20;
const BAR_H = 26;

interface TimelineViewProps {
  roadmap: Roadmap;
  items: RoadmapItem[];            // already filtered
  issues: Issue[];
  zoom: Zoom;
  showDeps: boolean;
  collapsedLanes: string[];
  onToggleLane: (lane: string) => void;
  onChangeItem: (item: RoadmapItem) => void;
  onOpenItem: (id: string) => void;
  onOpenMilestone: (id: string) => void;
  scrollToTodayKey: number;        // bump to scroll to today
}

interface Drag { id: string; mode: 'move' | 'start' | 'end'; originX: number; delta: number; moved: boolean }

/** Gantt-style timeline: swimlanes, draggable / resizable bars, progress, dependencies, milestones and a today line. */
export const TimelineView: React.FC<TimelineViewProps> = ({
  roadmap, items, issues, zoom, showDeps, collapsedLanes, onToggleLane, onChangeItem, onOpenItem, onOpenMilestone, scrollToTodayKey,
}) => {
  const today = useMemo(() => new Date(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const range = useMemo(() => computeRange(roadmap, today), [roadmap, today]);
  const ppd = fitPpd(zoom, range.days, useElementWidth(scrollRef) - LABEL_W); // the calendar fills the panel
  const header = useMemo(() => buildHeader(range, zoom, ppd), [range, zoom, ppd]);
  const { rows, height, yOf } = useMemo(() => layoutRows(items, roadmap.lanes, collapsedLanes), [items, roadmap.lanes, collapsedLanes]);
  const width = range.days * ppd;
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const todayX = xOf(range, today, ppd) + ppd / 2;

  // Scroll so today sits about a quarter in from the left
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTodayKey, zoom]);

  // Drag handling (window level so the pointer can leave the bar)
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = Math.round((e.clientX - d.originX) / ppd);
      if (delta !== d.delta) setDrag({ ...d, delta, moved: d.moved || delta !== 0 });
    };
    const onUp = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const base = items.find(i => i.id === d.id);
      if (!base) return;
      if (!d.moved || d.delta === 0) { onOpenItem(d.id); return; }
      onChangeItem(d.mode === 'move' ? shiftItem(base, d.delta) : resizeItem(base, d.mode, d.delta));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, ppd, items]);

  const view = (item: RoadmapItem): RoadmapItem => {
    if (!drag || drag.id !== item.id || drag.delta === 0) return item;
    return drag.mode === 'move' ? shiftItem(item, drag.delta) : resizeItem(item, drag.mode, drag.delta);
  };

  const problems = useMemo(() => dependencyIssues(roadmap.items), [roadmap.items]);
  const conflictKey = new Set(problems.filter(p => p.kind === 'conflict').map(p => `${p.from}>${p.to}`));

  // Milestone labels are stacked in as many rows as it takes for none to overlap
  const { milestones, milestoneH } = useMemo(() => {
    const placed = stackMilestones([...roadmap.milestones].sort((a, b) => a.date.localeCompare(b.date)).map(m => ({ ...m, x: xOf(range, parseDay(m.date), ppd) + ppd / 2 })));
    return { milestones: placed.labels, milestoneH: 10 + Math.max(2, placed.tiers) * MILESTONE_TIER_H };
  }, [roadmap.milestones, range, ppd]);

  // Dependency arrows between visible bars
  const arrows = useMemo(() => {
    if (!showDeps) return [];
    const byId = new Map(items.map(i => [i.id, view(i)]));
    const out: { id: string; d: string; conflict: boolean }[] = [];
    for (const item of items) {
      const to = byId.get(item.id)!;
      const y2 = yOf.get(item.id);
      if (y2 === undefined) continue;
      for (const depId of item.deps) {
        const from = byId.get(depId);
        const y1 = yOf.get(depId);
        if (!from || y1 === undefined) continue;
        const x1 = xOf(range, parseDay(from.end), ppd) + ppd;
        const x2 = xOf(range, parseDay(to.start), ppd);
        const ya = y1 + 20;
        const yb = y2 + 20;
        const mid = Math.max(x1 + 10, Math.min(x2 - 10, (x1 + x2) / 2));
        const d = x2 >= x1 + 14
          ? `M${x1},${ya} H${mid} V${yb} H${x2 - 1}`
          : `M${x1},${ya} H${x1 + 8} V${(ya + yb) / 2} H${x2 - 10} V${yb} H${x2 - 1}`;
        out.push({ id: `${depId}>${item.id}`, d, conflict: conflictKey.has(`${depId}>${item.id}`) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, drag, showDeps, range, ppd, yOf]);

  const startDrag = (e: React.PointerEvent, id: string, mode: Drag['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ id, mode, originX: e.clientX, delta: 0, moved: false });
  };

  return (
    <div ref={scrollRef} className="relative overflow-auto rounded-2xl border border-lira-border bg-lira-surface" style={{ maxHeight: 'calc(100vh - 250px)', minHeight: 360 }}>
      <div className="relative" style={{ width: LABEL_W + width, minHeight: HEADER_H + milestoneH + height }}>
        <TimelineHeader header={header} width={width} labelWidth={LABEL_W} height={HEADER_H} todayX={todayX} corner="Work item" />

        {/* ── Milestones row ── */}
        <div className="flex" style={{ height: milestoneH }}>
          <div className="sticky left-0 z-20 bg-lira-surface border-b border-r border-lira-border flex items-center gap-2 px-4 text-xs font-semibold text-lira-text" style={{ width: LABEL_W }}>
            <Flag className="w-3.5 h-3.5 text-lira-blue" /> Milestones &amp; releases
          </div>
          <div className="relative border-b border-lira-border" style={{ width }}>
            {milestones.map(m => (
              <button key={m.id} onClick={() => onOpenMilestone(m.id)} className="absolute -translate-x-[6px] flex flex-col items-start cursor-pointer hover:opacity-80 transition-opacity" style={{ left: m.x, top: 4 + m.tier * MILESTONE_TIER_H }} title={`${m.title} · ${fmtShort(m.date)}`}>
                <div className="flex items-center gap-1 whitespace-nowrap text-3xs font-medium text-lira-text">
                  {m.kind === 'release'
                    ? <Flag className="w-3 h-3 text-emerald-500 fill-emerald-500/30" />
                    : <Diamond className="w-3 h-3 text-violet-500 fill-violet-500/40" />}
                  <span>{m.title}</span>
                  <span className="text-lira-muted">{fmtShort(m.date)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Body: labels + canvas ── */}
        <div className="flex" style={{ height }}>
          <div className="sticky left-0 z-20 bg-lira-surface border-r border-lira-border" style={{ width: LABEL_W }}>
            {rows.map(r => r.kind === 'lane' ? (
              <button
                key={`l-${r.lane}`}
                onClick={() => onToggleLane(r.lane)}
                className="w-full flex items-center gap-2 px-3 text-left bg-lira-bg/70 border-b border-lira-border/70 cursor-pointer hover:bg-lira-bg"
                style={{ height: r.h }}
              >
                <ChevronDown className={`w-3.5 h-3.5 text-lira-muted transition-transform ${collapsedLanes.includes(r.lane) ? '-rotate-90' : ''}`} />
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: laneColor(roadmap, r.lane) }} />
                <span className="text-xs font-semibold text-lira-text truncate">{r.lane}</span>
                <span className="ml-auto text-3xs text-lira-muted bg-lira-surface border border-lira-border rounded-full px-1.5">{r.count}</span>
              </button>
            ) : (
              <button
                key={r.item.id}
                onClick={() => onOpenItem(r.item.id)}
                className="w-full flex items-center gap-2 pl-8 pr-3 text-left border-b border-lira-border/50 cursor-pointer hover:bg-lira-bg/60"
                style={{ height: r.h }}
                title={r.item.title}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_META[resolveItem(r.item, issues, today).status].color }} />
                <span className="text-xs text-lira-text truncate">{r.item.title}</span>
                {r.item.owner && <span className="ml-auto text-4xs font-bold text-white bg-lira-blue/80 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{r.item.owner.slice(0, 2).toUpperCase()}</span>}
              </button>
            ))}
          </div>

          <div className="relative" style={{ width, height }}>
            {/* period gridlines */}
            {header.bottom.map((c, i) => <div key={i} className="absolute top-0 bottom-0 border-r border-lira-border/40" style={{ left: c.x + c.width - 1 }} />)}
            {/* weekend / lane bands */}
            {rows.map(r => r.kind === 'lane' ? (
              <div key={`b-${r.lane}`} className="absolute left-0 right-0 bg-lira-bg/70 border-b border-lira-border/70" style={{ top: r.y, height: r.h }}>
                {(() => {
                  const inLane = items.filter(i => i.lane === r.lane);
                  if (!inLane.length) return null;
                  const s = inLane.map(i => i.start).sort()[0];
                  const e = inLane.map(i => i.end).sort().slice(-1)[0];
                  return <div className="absolute top-[13px] h-2 rounded-full opacity-35" style={{ left: xOf(range, parseDay(s), ppd), width: (daysBetween(parseDay(s), parseDay(e)) + 1) * ppd, background: laneColor(roadmap, r.lane) }} />;
                })()}
              </div>
            ) : (
              <div key={`r-${r.item.id}`} className="absolute left-0 right-0 border-b border-lira-border/40" style={{ top: r.y, height: r.h }} />
            ))}

            {/* milestone guide lines */}
            {milestones.map(m => <div key={`g-${m.id}`} className={`absolute top-0 bottom-0 border-l border-dashed ${m.kind === 'release' ? 'border-emerald-400/50' : 'border-violet-400/50'}`} style={{ left: m.x }} />)}
            {/* today line */}
            <div className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10" style={{ left: todayX }} />

            {/* dependency arrows */}
            {showDeps && (
              <svg className="absolute inset-0 pointer-events-none z-10" width={width} height={height}>
                <defs>
                  <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8590A2" /></marker>
                  <marker id="arr-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={PALETTE.criticalDeep} /></marker>
                </defs>
                {arrows.map(a => (
                  <path key={a.id} d={a.d} fill="none" stroke={a.conflict ? PALETTE.criticalDeep : '#8590A2'} strokeWidth={1.4} strokeDasharray={a.conflict ? '4 3' : undefined} markerEnd={`url(#${a.conflict ? 'arr-bad' : 'arr'})`} />
                ))}
              </svg>
            )}

            {/* bars */}
            {rows.map(r => {
              if (r.kind !== 'item') return null;
              const it = view(r.item);
              const { progress, status } = resolveItem(it, issues, today);
              const color = STATUS_META[status].color;
              const left = xOf(range, parseDay(it.start), ppd);
              const w = Math.max(ppd, (daysBetween(parseDay(it.start), parseDay(it.end)) + 1) * ppd);
              const dragging = drag?.id === it.id && drag.moved;
              return (
                <div
                  key={it.id}
                  className={`absolute group rounded-md select-none ${dragging ? 'z-20 shadow-lg ring-2 ring-white/60' : 'z-[15]'}`}
                  style={{ left, width: w, top: r.y + (r.h - BAR_H) / 2, height: BAR_H, background: color + '33', border: `1px solid ${color}`, cursor: dragging ? 'grabbing' : 'grab' }}
                  onPointerDown={e => startDrag(e, it.id, 'move')}
                  title={`${it.title}\n${fmtShort(it.start)} → ${fmtShort(it.end)} · ${progress}%`}
                >
                  <div className="absolute inset-y-0 left-0" style={{ width: `${progress}%`, background: color, opacity: 0.6, borderRadius: progress >= 100 ? 5 : '5px 0 0 5px' }} />
                  <div className="relative h-full flex items-center px-2 text-2xs font-medium whitespace-nowrap overflow-hidden text-lira-text">
                    <span className="truncate">{w > 90 ? it.title : ''}</span>
                    {w > 150 && <span className="ml-auto pl-2 opacity-80">{progress}%</span>}
                  </div>
                  <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-l-md" onPointerDown={e => startDrag(e, it.id, 'start')} />
                  <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r-md" onPointerDown={e => startDrag(e, it.id, 'end')} />
                  {w <= 90 && (
                    <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-2xs text-lira-text whitespace-nowrap pointer-events-none">{it.title}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
