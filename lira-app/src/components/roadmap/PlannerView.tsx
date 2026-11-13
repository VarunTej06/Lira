import { useElementWidth } from '../../hooks/useElementWidth';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TimelineHeader } from './TimelineHeader';
import { PlannerLabels } from './PlannerLabels';
import { EpicBar, TicketBar } from './PlannerBars';
import { dragTip, dropAction, type Drag } from './plannerDrag';
import { GripHorizontal } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  buildHeader, buildPlannerRows, computeRange, fitPpd,
  parseDay, ticketDate, xOf,
  type Roadmap, type RoadmapItem,
} from '../../utils/roadmapUtils';
import { PALETTE } from '../../theme/palette';

const LABEL_W = 380;
const HEADER_H = 52;

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
  const ppd = fitPpd('months', range.days, useElementWidth(scrollRef) - LABEL_W); // the calendar fills the panel
  const header = useMemo(() => buildHeader(range, 'months', ppd), [range, ppd]);
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
      const action = dropAction(d, items, issues);
      if (!action) return;
      if (action.type === 'openItem') onOpenItem(action.id);
      else if (action.type === 'openIssue') onOpenIssue(action.issue);
      else if (action.type === 'changeItem') onChangeItem(action.item);
      else onMoveTicket(action.issue, action.date);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, items, issues, ppd]);

  const start = (e: React.PointerEvent, kind: Drag['kind'], id: string | number, mode: Drag['mode']) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({ kind, id, mode, originX: e.clientX, originScroll: scrollRef.current?.scrollLeft ?? 0, delta: 0, moved: false, x: e.clientX, y: e.clientY });
  };

  const tip = dragTip(drag, items, issues);

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-lira-muted">
        <span className="flex items-center gap-1.5"><GripHorizontal className="w-3.5 h-3.5" /> Drag an epic bar or a ticket chip to another day or month. Edges of a bar change its length.</span>
        <span>{ticketCount} tickets shown{unscheduled > 0 ? ` · ${unscheduled} without a due date (dashed, at the start of their sprint month)` : ''}</span>
      </div>

      <div ref={scrollRef} className="relative overflow-auto rounded-2xl border border-lira-border bg-lira-surface" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: 360 }}>
        <div className="relative" style={{ width: LABEL_W + width, minHeight: HEADER_H + height }}>
          <TimelineHeader header={header} width={width} labelWidth={LABEL_W} height={HEADER_H} todayX={todayX} corner="Lane · Epic · Ticket" />

          {/* body */}
          <div className="flex" style={{ height }}>
            <PlannerLabels
              roadmap={roadmap} rows={rows} issues={issues} today={today} width={LABEL_W} collapsedLanes={collapsedLanes}
              adding={adding} setAdding={setAdding} submitAdd={submitAdd} onToggleLane={onToggleLane} toggleEpic={toggleEpic}
              onOpenItem={onOpenItem} onOpenIssue={onOpenIssue}
            />

            {/* canvas */}
            <div className="relative" style={{ width, height }}>
              {header.bottom.map((c, i) => <div key={i} className="absolute top-0 bottom-0 border-r border-lira-border/40" style={{ left: c.x + c.width - 1 }} />)}
              {rows.map(r => (
                <div
                  key={`bg-${r.kind}-${r.kind === 'lane' ? r.lane : r.kind === 'epic' ? r.item.id : r.issue.id}`}
                  className={`absolute left-0 right-0 border-b ${r.kind === 'lane' ? 'bg-lira-bg/70 border-lira-border/70' : r.kind === 'epic' ? 'border-lira-border/50' : 'border-lira-border/30 bg-lira-bg/20'}`}
                  style={{ top: r.y, height: r.h }}
                />
              ))}
              <div className="absolute top-0 bottom-0 w-px bg-red-500/80 z-10" style={{ left: todayX }} />
              {roadmap.milestones.map(m => (
                <div key={m.id} className={`absolute top-0 bottom-0 border-l border-dashed ${m.kind === 'release' ? 'border-emerald-400/40' : 'border-violet-400/40'}`} style={{ left: xOf(range, parseDay(m.date), ppd) + ppd / 2 }} title={m.title} />
              ))}

              {rows.map(r => {
                if (r.kind === 'epic') return <EpicBar key={`eb-${r.item.id}`} item={r.item} y={r.y} h={r.h} drag={drag} issues={issues} today={today} range={range} ppd={ppd} onStart={start} />;
                if (r.kind === 'ticket') return <TicketBar key={`tb-${r.issue.id}`} issue={r.issue} y={r.y} h={r.h} drag={drag} range={range} ppd={ppd} onStart={start} />;
                return null;
              })}
            </div>
          </div>
        </div>
      </div>

      {drag?.moved && tip && (
        <div className="fixed z-[100] pointer-events-none px-2 py-1 rounded-md bg-lira-text text-lira-bg text-2xs font-semibold shadow-lg" style={{ left: drag.x + 14, top: drag.y + 14, background: PALETTE.textStrong, color: '#fff' }}>
          {tip}
        </div>
      )}
    </div>
  );
};
