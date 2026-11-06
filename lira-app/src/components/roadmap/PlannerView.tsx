import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, GripHorizontal, Plus } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  PX_PER_DAY, STATUS_META, buildHeader, buildPlannerRows, computeRange, daysBetween, fmtDay, fmtShort, laneColor, movedDate,
  parseDay, resizeItem, resolveItem, shiftItem, ticketDate, xOf,
  type Roadmap, type RoadmapItem,
} from '../../utils/roadmapUtils';

const LABEL_W = 380;
const HEADER_H = 52;
const ppd = PX_PER_DAY.months;

interface PlannerViewProps {
  roadmap: Roadmap;
  items: RoadmapItem[];                 // already filtered
  issues: Issue[];
  collapsedLanes: string[];
  onToggleLane: (lane: string) => void;
  onChangeItem: (item: RoadmapItem) => void;           // an epic was moved or resized
  onMoveTicket: (issue: Issue, date: Date) => void;    // a ticket was dropped on a new date
  onOpenItem: (id: string) => void;
  onOpenIssue: (issue: Issue) => void;
  onAddTicket: (epic: Issue, title: string) => void;
  scrollToTodayKey: number;
}

interface Drag {
  kind: 'epic' | 'ticket';
  id: string | number;
  mode: 'move' | 'start' | 'end';
  originX: number;
  originScroll: number;
  delta: number;
  moved: boolean;
  x: number;
  y: number;
}

const ticketColor = (status: string) => {
  const s = status?.toLowerCase();
  return s === 'done' ? '#22A06B' : s === 'inprogress' ? '#0C66E4' : '#6B778C';
};

/** Lane > epic > ticket rows against a calendar. Drag an epic bar or a ticket chip to another day or month to reschedule it. */
export const PlannerView: React.FC<PlannerViewProps> = ({
  roadmap, items, issues, collapsedLanes, onToggleLane, onChangeItem, onMoveTicket, onOpenItem, onOpenIssue, onAddTicket, scrollToTodayKey,
}) => {
  const today = useMemo(() => new Date(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedEpics, setCollapsedEpics] = useState<string[]>([]);
  const [adding, setAdding] = useState<{ id: string; text: string } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const { rows, height } = useMemo(
    () => buildPlannerRows(items, roadmap.lanes, issues, collapsedLanes, collapsedEpics),
    [items, roadmap.lanes, issues, collapsedLanes, collapsedEpics],
  );

  // The calendar must also cover every ticket that is shown
  const range = useMemo(() => {
    const extra: Date[] = [];
    rows.forEach(r => { if (r.kind === 'ticket') extra.push(ticketDate(r.issue).date); });
    return computeRange(roadmap, today, extra);
  }, [roadmap, rows, today]);
  const header = useMemo(() => buildHeader(range, 'months'), [range]);
  const width = range.days * ppd;
  const todayX = xOf(range, today, ppd) + ppd / 2;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTodayKey]);

  // Pointer drag (window level, so the pointer may leave the element), with edge auto-scroll
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const sc = scrollRef.current;
      if (!d || !sc) return;
      const r = sc.getBoundingClientRect();
      if (e.clientX > r.right - 70) sc.scrollLeft += 26;
      else if (e.clientX < r.left + LABEL_W + 40) sc.scrollLeft -= 26;
      const delta = Math.round(((e.clientX - d.originX) + (sc.scrollLeft - d.originScroll)) / ppd);
      setDrag({ ...d, delta, moved: d.moved || delta !== 0, x: e.clientX, y: e.clientY });
    };
    const onUp = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      if (!d.moved || d.delta === 0) {
        if (d.kind === 'epic') onOpenItem(String(d.id)); else { const t = issues.find(i => i.id === d.id); if (t) onOpenIssue(t); }
        return;
      }
      if (d.kind === 'epic') {
        const base = items.find(i => i.id === d.id);
        if (base) onChangeItem(d.mode === 'move' ? shiftItem(base, d.delta) : resizeItem(base, d.mode, d.delta));
      } else {
        const t = issues.find(i => i.id === d.id);
        if (t) onMoveTicket(t, movedDate(ticketDate(t).date, d.delta));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, items, issues]);

  const start = (e: React.PointerEvent, kind: Drag['kind'], id: string | number, mode: Drag['mode']) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({ kind, id, mode, originX: e.clientX, originScroll: scrollRef.current?.scrollLeft ?? 0, delta: 0, moved: false, x: e.clientX, y: e.clientY });
  };

  const dragLabel = (): string | null => {
    if (!drag || !drag.moved) return null;
    if (drag.kind === 'epic') {
      const base = items.find(i => i.id === drag.id);
      if (!base) return null;
      const v = drag.mode === 'move' ? shiftItem(base, drag.delta) : resizeItem(base, drag.mode, drag.delta);
      return `${fmtShort(v.start)} → ${fmtShort(v.end)}`;
    }
    const t = issues.find(i => i.id === drag.id);
    return t ? movedDate(ticketDate(t).date, drag.delta).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null;
  };
  const tip = dragLabel();

  const toggleEpic = (id: string) => setCollapsedEpics(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));
  const submitAdd = () => {
    if (!adding) return;
    const row = rows.find(r => r.kind === 'epic' && r.item.id === adding.id);
    if (row && row.kind === 'epic' && row.epic && adding.text.trim()) onAddTicket(row.epic, adding.text.trim());
    setAdding(null);
  };

  const unscheduled = rows.filter(r => r.kind === 'ticket' && !ticketDate(r.issue).scheduled).length;
  const ticketCount = rows.filter(r => r.kind === 'ticket').length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-jira-muted">
        <span className="flex items-center gap-1.5"><GripHorizontal className="w-3.5 h-3.5" /> Drag an epic bar or a ticket chip to another day or month. Edges of a bar change its length.</span>
        <span>{ticketCount} tickets shown{unscheduled > 0 ? ` · ${unscheduled} without a due date (dashed, at the start of their sprint month)` : ''}</span>
      </div>

      <div ref={scrollRef} className="relative overflow-auto rounded-2xl border border-jira-border bg-jira-surface" style={{ maxHeight: 'calc(100vh - 360px)', minHeight: 320 }}>
        <div className="relative" style={{ width: LABEL_W + width, minHeight: HEADER_H + height }}>
          {/* header */}
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_H }}>
            <div className="sticky left-0 z-40 bg-jira-surface border-b border-r border-jira-border flex items-end px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-jira-muted" style={{ width: LABEL_W }}>
              Lane · Epic · Ticket
            </div>
            <div className="relative bg-jira-surface border-b border-jira-border" style={{ width }}>
              {header.top.map((c, i) => <div key={i} className="absolute top-0 h-6 flex items-center px-2 text-[11px] font-semibold text-jira-text border-r border-jira-border/70" style={{ left: c.x, width: c.width }}>{c.label}</div>)}
              {header.bottom.map((c, i) => <div key={i} className="absolute top-6 h-[26px] flex items-center px-2 text-[11px] text-jira-muted border-r border-t border-jira-border/60" style={{ left: c.x, width: c.width }}>{c.label}</div>)}
              <div className="absolute top-[28px] -translate-x-1/2 px-1.5 rounded bg-red-500 text-white text-[9px] font-bold z-10 leading-[14px]" style={{ left: todayX }}>TODAY</div>
            </div>
          </div>

          {/* body */}
          <div className="flex" style={{ height }}>
            {/* labels */}
            <div className="sticky left-0 z-20 bg-jira-surface border-r border-jira-border" style={{ width: LABEL_W }}>
              {rows.map(r => {
                if (r.kind === 'lane') return (
                  <button key={`l-${r.lane}`} onClick={() => onToggleLane(r.lane)} className="w-full flex items-center gap-2 px-3 text-left bg-jira-bg/70 border-b border-jira-border/70 cursor-pointer hover:bg-jira-bg" style={{ height: r.h }}>
                    <ChevronDown className={`w-3.5 h-3.5 text-jira-muted transition-transform ${collapsedLanes.includes(r.lane) ? '-rotate-90' : ''}`} />
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: laneColor(roadmap, r.lane) }} />
                    <span className="text-xs font-semibold text-jira-text truncate">{r.lane}</span>
                    <span className="ml-auto text-[10px] text-jira-muted bg-jira-surface border border-jira-border rounded-full px-1.5">{r.count}</span>
                  </button>
                );
                if (r.kind === 'epic') {
                  const { status } = resolveItem(r.item, issues, today);
                  const isAdding = adding?.id === r.item.id;
                  return (
                    <div key={`e-${r.item.id}`} className="group flex items-center gap-1.5 pl-5 pr-2 border-b border-jira-border/50 hover:bg-jira-bg/50" style={{ height: r.h }}>
                      <button onClick={() => toggleEpic(r.item.id)} disabled={r.tickets.length === 0} className="p-0.5 text-jira-muted disabled:opacity-30 cursor-pointer" aria-label={r.expanded ? 'Collapse epic' : 'Expand epic'}>
                        {r.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] bg-violet-500/20 text-violet-500 flex-shrink-0" title="Epic">⚡</span>
                      {isAdding ? (
                        <input
                          autoFocus
                          value={adding!.text}
                          onChange={e => setAdding({ id: r.item.id, text: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAdding(null); }}
                          onBlur={() => setAdding(null)}
                          placeholder={`New task in ${r.epic?.key}…  Enter to add`}
                          className="flex-1 min-w-0 border border-jira-blue rounded px-2 py-1 text-xs bg-jira-surface text-jira-text focus:outline-none"
                        />
                      ) : (
                        <button onClick={() => onOpenItem(r.item.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer" title={r.item.title}>
                          <span className="text-[10px] font-mono text-jira-muted flex-shrink-0">{r.epic?.key || r.item.epicKey || 'no epic'}</span>
                          <span className="text-xs font-medium text-jira-text truncate">{r.item.title}</span>
                        </button>
                      )}
                      {!isAdding && (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: STATUS_META[status].color + '22', color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
                          {r.tickets.length > 0 && <span className="text-[10px] text-jira-muted flex-shrink-0">{r.tickets.length}</span>}
                          {r.epic && <button onClick={() => setAdding({ id: r.item.id, text: '' })} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-jira-muted hover:text-jira-blue hover:bg-jira-bg cursor-pointer flex-shrink-0" title="Add a task to this epic" aria-label="Add a task to this epic"><Plus className="w-3.5 h-3.5" /></button>}
                        </>
                      )}
                    </div>
                  );
                }
                const t = r.issue;
                return (
                  <button key={`t-${t.id}`} onClick={() => onOpenIssue(t)} className="w-full flex items-center gap-2 pl-14 pr-3 text-left border-b border-jira-border/40 hover:bg-jira-bg/50 cursor-pointer" style={{ height: r.h }} title={t.title}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ticketColor(t.status) }} />
                    <span className="text-[10px] font-mono text-jira-muted flex-shrink-0">{t.key}</span>
                    <span className="text-xs text-jira-text truncate">{t.title}</span>
                    {t.assigneeInitials && <span className="ml-auto text-[9px] font-bold text-white bg-jira-blue/70 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">{t.assigneeInitials.slice(0, 2)}</span>}
                  </button>
                );
              })}
            </div>

            {/* canvas */}
            <div className="relative" style={{ width, height }}>
              {header.bottom.map((c, i) => <div key={i} className="absolute top-0 bottom-0 border-r border-jira-border/40" style={{ left: c.x + c.width - 1 }} />)}
              {rows.map(r => (
                <div
                  key={`bg-${r.kind}-${r.kind === 'lane' ? r.lane : r.kind === 'epic' ? r.item.id : r.issue.id}`}
                  className={`absolute left-0 right-0 border-b ${r.kind === 'lane' ? 'bg-jira-bg/70 border-jira-border/70' : r.kind === 'epic' ? 'border-jira-border/50' : 'border-jira-border/30 bg-jira-bg/20'}`}
                  style={{ top: r.y, height: r.h }}
                />
              ))}
              <div className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10" style={{ left: todayX }} />
              {roadmap.milestones.map(m => (
                <div key={m.id} className={`absolute top-0 bottom-0 border-l border-dashed ${m.kind === 'release' ? 'border-emerald-400/40' : 'border-violet-400/40'}`} style={{ left: xOf(range, parseDay(m.date), ppd) + ppd / 2 }} title={m.title} />
              ))}

              {rows.map(r => {
                if (r.kind === 'epic') {
                  const live = drag && drag.kind === 'epic' && drag.id === r.item.id && drag.delta !== 0
                    ? (drag.mode === 'move' ? shiftItem(r.item, drag.delta) : resizeItem(r.item, drag.mode, drag.delta)) : r.item;
                  const { progress, status } = resolveItem(live, issues, today);
                  const color = STATUS_META[status].color;
                  const left = xOf(range, parseDay(live.start), ppd);
                  const w = Math.max(ppd, (daysBetween(parseDay(live.start), parseDay(live.end)) + 1) * ppd);
                  const dragging = drag?.kind === 'epic' && drag.id === r.item.id && drag.moved;
                  return (
                    <div
                      key={`eb-${r.item.id}`}
                      className={`absolute group rounded-md select-none ${dragging ? 'z-20 shadow-lg ring-2 ring-white/60' : 'z-[15]'}`}
                      style={{ left, width: w, top: r.y + 8, height: r.h - 16, background: color + '33', border: `1px solid ${color}`, cursor: dragging ? 'grabbing' : 'grab' }}
                      onPointerDown={e => start(e, 'epic', r.item.id, 'move')}
                      title={`${r.item.title}\n${fmtShort(live.start)} → ${fmtShort(live.end)} · ${progress}%`}
                    >
                      <div className="absolute inset-y-0 left-0" style={{ width: `${progress}%`, background: color, opacity: 0.55, borderRadius: progress >= 100 ? 5 : '5px 0 0 5px' }} />
                      <div className="relative h-full flex items-center px-2 text-[11px] font-medium whitespace-nowrap overflow-hidden text-jira-text">
                        <span className="truncate">{w > 100 ? r.item.title : ''}</span>
                        {w > 170 && <span className="ml-auto pl-2 opacity-80">{progress}%</span>}
                      </div>
                      <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-l-md" onPointerDown={e => start(e, 'epic', r.item.id, 'start')} />
                      <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r-md" onPointerDown={e => start(e, 'epic', r.item.id, 'end')} />
                      {w <= 100 && <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-[11px] text-jira-text whitespace-nowrap pointer-events-none">{r.item.title}</span>}
                    </div>
                  );
                }
                if (r.kind === 'ticket') {
                  const t = r.issue;
                  const base = ticketDate(t);
                  const dragging = drag?.kind === 'ticket' && drag.id === t.id && drag.moved;
                  const date = dragging ? movedDate(base.date, drag!.delta) : base.date;
                  const x = xOf(range, date, ppd);
                  const color = ticketColor(t.status);
                  return (
                    <div
                      key={`tb-${t.id}`}
                      className={`absolute flex items-center gap-1.5 rounded-full select-none pl-1.5 pr-2.5 text-[11px] whitespace-nowrap ${dragging ? 'z-20 shadow-lg ring-2 ring-white/60' : 'z-[15]'}`}
                      style={{ left: x, top: r.y + 5, height: r.h - 10, maxWidth: 260, background: color + '26', border: `1px ${base.scheduled ? 'solid' : 'dashed'} ${color}`, cursor: dragging ? 'grabbing' : 'grab' }}
                      onPointerDown={e => start(e, 'ticket', t.id!, 'move')}
                      title={`${t.key} · ${t.title}\n${base.scheduled ? `Due ${fmtDay(base.date)}` : 'No due date: drag to schedule'}`}
                    >
                      <CalendarDays className="w-3 h-3 flex-shrink-0" style={{ color }} />
                      <span className="font-mono text-[10px] text-jira-muted">{t.key}</span>
                      <span className="truncate text-jira-text">{t.title}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>

      {drag?.moved && tip && (
        <div className="fixed z-[100] pointer-events-none px-2 py-1 rounded-md bg-jira-text text-jira-bg text-[11px] font-semibold shadow-lg" style={{ left: drag.x + 14, top: drag.y + 14, background: '#172B4D', color: '#fff' }}>
          {tip}
        </div>
      )}
    </div>
  );
};
