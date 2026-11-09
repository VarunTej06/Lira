import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  PX_PER_DAY, STATUS_META, daysBetween, fmtDay, fmtShort, movedDate, parseDay, resolveItem, ticketDate, xOf, type computeRange, type RoadmapItem,
} from '../../utils/roadmapUtils';
import { PALETTE } from '../../theme/palette';
import { liveItem, type Drag } from './plannerDrag';

const ppd = PX_PER_DAY.months;
type Range = ReturnType<typeof computeRange>;
type StartDrag = (e: React.PointerEvent, kind: Drag['kind'], id: string | number, mode: Drag['mode']) => void;

const ticketColor = (status: string) => {
  const s = status?.toLowerCase();
  return s === 'done' ? PALETTE.successSoft : s === 'inprogress' ? PALETTE.link : PALETTE.textMuted;
};

/** One epic as a bar on the calendar: drag to move, drag an edge to change its length. */
export function EpicBar({ item, y, h, drag, issues, today, range, onStart }: { item: RoadmapItem; y: number; h: number; drag: Drag | null; issues: Issue[]; today: Date; range: Range; onStart: StartDrag }) {
  const live = liveItem(item, drag);
  const { progress, status } = resolveItem(live, issues, today);
  const color = STATUS_META[status].color;
  const left = xOf(range, parseDay(live.start), ppd);
  const w = Math.max(ppd, (daysBetween(parseDay(live.start), parseDay(live.end)) + 1) * ppd);
  const dragging = drag?.kind === 'epic' && drag.id === item.id && drag.moved;
  return (
    <div
              className={`absolute group rounded-md select-none ${dragging ? 'z-20 shadow-lg ring-2 ring-white/60' : 'z-[15]'}`}
      style={{ left, width: w, top: y + 8, height: h - 16, background: color + '33', border: `1px solid ${color}`, cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={e => onStart(e, 'epic', item.id, 'move')}
      title={`${item.title}\n${fmtShort(live.start)} → ${fmtShort(live.end)} · ${progress}%`}
    >
      <div className="absolute inset-y-0 left-0" style={{ width: `${progress}%`, background: color, opacity: 0.55, borderRadius: progress >= 100 ? 5 : '5px 0 0 5px' }} />
      <div className="relative h-full flex items-center px-2 text-2xs font-medium whitespace-nowrap overflow-hidden text-lira-text">
        <span className="truncate">{w > 100 ? item.title : ''}</span>
        {w > 170 && <span className="ml-auto pl-2 opacity-80">{progress}%</span>}
      </div>
      <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-l-md" onPointerDown={e => onStart(e, 'epic', item.id, 'start')} />
      <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 rounded-r-md" onPointerDown={e => onStart(e, 'epic', item.id, 'end')} />
      {w <= 100 && <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-2xs text-lira-text whitespace-nowrap pointer-events-none">{item.title}</span>}
    </div>
  );
}

/** One ticket as a chip on the calendar: drag to give it another due date. */
export function TicketBar({ issue, y, h, drag, range, onStart }: { issue: Issue; y: number; h: number; drag: Drag | null; range: Range; onStart: StartDrag }) {
  const t = issue;
  const base = ticketDate(t);
  const dragging = drag?.kind === 'ticket' && drag.id === t.id && drag.moved;
  const date = dragging ? movedDate(base.date, drag!.delta) : base.date;
  const x = xOf(range, date, ppd);
  const color = ticketColor(t.status);
  return (
    <div
      className={`absolute flex items-center gap-1.5 rounded-full select-none pl-1.5 pr-2.5 text-2xs whitespace-nowrap ${dragging ? 'z-20 shadow-lg ring-2 ring-white/60' : 'z-[15]'}`}
      style={{ left: x, top: y + 5, height: h - 10, maxWidth: 260, background: color + '26', border: `1px ${base.scheduled ? 'solid' : 'dashed'} ${color}`, cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={e => onStart(e, 'ticket', t.id!, 'move')}
      title={`${t.key} · ${t.title}\n${base.scheduled ? `Due ${fmtDay(base.date)}` : 'No due date: drag to schedule'}`}
    >
      <CalendarDays className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <span className="font-mono text-3xs text-lira-muted">{t.key}</span>
      <span className="truncate text-lira-text">{t.title}</span>
    </div>
  );
}
