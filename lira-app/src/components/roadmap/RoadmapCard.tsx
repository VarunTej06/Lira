import React from 'react';
import { Archive, ArchiveRestore, CalendarRange, Copy, Flag, Layers, Map, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { CountUp, GrowBar } from '../common/motion';
import { roadmapLink } from '../../utils/links';
import type { Space } from '../../types/space';
import { STATUS_META, fmtShort, laneColor, type RoadmapStatus } from '../../utils/roadmapUtils';
import type { HomeCard } from './roadmapHomeRules';

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer ${danger ? 'text-red-500 hover:bg-red-500/10' : 'text-lira-text hover:bg-lira-bg'}`}>{icon}{label}</button>
);

interface Props {
  card: HomeCard;
  space: Space | undefined;
  menuOpen: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  onToggleMenu: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

/** The "..." menu of a card: rename, duplicate, archive or unarchive, delete. */
function CardMenu({ archived, onRename, onDuplicate, onToggleArchive, onDelete }: { archived: boolean; onRename: () => void; onDuplicate: () => void; onToggleArchive: () => void; onDelete: () => void }) {
  return (
    <div className="absolute right-0 mt-1 w-44 rounded-lg border border-lira-border bg-lira-surface shadow-dropdown z-30 py-1 text-xs" onClick={e => e.stopPropagation()}>
      <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={onRename} />
      <MenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" onClick={onDuplicate} />
      <MenuItem icon={archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} label={archived ? 'Unarchive' : 'Archive'} onClick={onToggleArchive} />
      <MenuItem danger icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" onClick={onDelete} />
    </div>
  );
}

/** Progress of the epics, and a chip for each status that has some. */
function Progress({ summary }: { summary: HomeCard['summary'] }) {
  return (
    <>
      <div className="mt-3">
        <div className="flex items-center justify-between text-2xs mb-1"><span className="text-lira-muted"><CountUp value={summary.byStatus.done} /> of <CountUp value={summary.total} /> epics done</span><span className="font-semibold text-lira-text"><CountUp value={summary.percent} suffix="%" /></span></div>
        <div className="h-1.5 rounded-full bg-lira-border/60 overflow-hidden"><GrowBar className="h-full rounded-full bg-lira-blue" percent={summary.percent} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {(Object.keys(STATUS_META) as RoadmapStatus[]).filter(s => summary.byStatus[s] > 0).map(s => (
          <span key={s} className="text-3xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: STATUS_META[s].color + '22', color: STATUS_META[s].color }}><CountUp value={summary.byStatus[s]} suffix={` ${STATUS_META[s].label.toLowerCase()}`} /></span>
        ))}
        {summary.total === 0 && <span className="text-3xs text-lira-muted">Empty roadmap</span>}
      </div>
    </>
  );
}

/** One roadmap as a card: name, space, description, progress, lanes, dates and the next milestone. Click opens it. */
export function RoadmapCard({ card: { rm, summary, span }, space, menuOpen, onOpen, onToggleStar, onToggleMenu, onRename, onDuplicate, onToggleArchive, onDelete }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); onOpen(); }} {...roadmapLink(rm.id)}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
      className={`group relative rounded-2xl border border-lira-border bg-lira-surface p-4 cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all ${rm.archived ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center flex-shrink-0"><Map className="w-4.5 h-4.5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-lira-text truncate">{rm.name}</h3>
          <div className="text-2xs text-lira-muted flex items-center gap-1.5 mt-0.5">
            {space ? <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{space.name}</span> : <span>No space</span>}
            {rm.archived && <span className="px-1.5 rounded-full bg-lira-border/60">Archived</span>}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onToggleStar(); }} className={`p-1 rounded-md cursor-pointer ${rm.starred ? 'text-yellow-400' : 'text-lira-muted opacity-0 group-hover:opacity-100'} hover:bg-lira-bg`} aria-label={rm.starred ? 'Remove star' : 'Star roadmap'}>
          <Star className={`w-4 h-4 ${rm.starred ? 'fill-yellow-400' : ''}`} />
        </button>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); onToggleMenu(); }} className="p-1 rounded-md text-lira-muted hover:text-lira-text hover:bg-lira-bg cursor-pointer" aria-label="Roadmap actions"><MoreHorizontal className="w-4 h-4" /></button>
          {menuOpen && <CardMenu archived={!!rm.archived} onRename={onRename} onDuplicate={onDuplicate} onToggleArchive={onToggleArchive} onDelete={onDelete} />}
        </div>
      </div>

      <p className="text-xs text-lira-muted mt-2 line-clamp-2 min-h-[32px]">{rm.description || 'No description'}</p>
      <Progress summary={summary} />

      <div className="flex items-center gap-1 mt-3">
        {rm.lanes.slice(0, 8).map(l => <span key={l} className="w-2 h-2 rounded-sm" style={{ background: laneColor(rm, l) }} title={l} />)}
        <span className="text-3xs text-lira-muted ml-1">{rm.lanes.length} lanes</span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-lira-border/60 text-2xs text-lira-muted">
        <span className="flex items-center gap-1"><CalendarRange className="w-3 h-3" />{span.start ? `${fmtShort(span.start)} → ${fmtShort(span.end!)}` : 'No dates'}</span>
        {summary.nextMilestone && <span className="flex items-center gap-1 truncate max-w-[50%]" title={summary.nextMilestone.title}><Flag className="w-3 h-3" />{summary.daysToNextMilestone === 0 ? 'today' : `${summary.daysToNextMilestone}d`}: {summary.nextMilestone.title}</span>}
      </div>
    </div>
  );
}
