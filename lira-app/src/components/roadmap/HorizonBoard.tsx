import React from 'react';
import { CalendarRange, GitBranch } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  STATUS_META, fmtShort, horizonOf, laneColor, resolveItem,
  type Horizon, type Roadmap, type RoadmapItem,
} from '../../utils/roadmapUtils';
import { currentTime } from '../../utils/clock';

const COLUMNS: { key: Horizon; title: string; hint: string }[] = [
  { key: 'now', title: 'Now', hint: 'In progress or starting this week' },
  { key: 'next', title: 'Next', hint: 'Starts within about two months' },
  { key: 'later', title: 'Later', hint: 'Further out' },
  { key: 'done', title: 'Done', hint: 'Finished' },
];

interface Props { roadmap: Roadmap; items: RoadmapItem[]; issues: Issue[]; onOpenItem: (id: string) => void }

/** Now / Next / Later: the same items grouped by how soon they happen, for planning conversations. */
export const HorizonBoard: React.FC<Props> = ({ roadmap, items, issues, onOpenItem }) => {
  const today = currentTime();
  const decorated = items.map(i => {
    const { progress: p, status: s, epic } = resolveItem(i, issues, today);
    return { item: i, progress: p, status: s, epic, horizon: horizonOf(i, s, today) };
  });
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map(col => {
        const list = decorated.filter(d => d.horizon === col.key).sort((a, b) => a.item.start.localeCompare(b.item.start));
        return (
          <div key={col.key} className="rounded-2xl border border-lira-border bg-lira-bg/60 p-3 flex flex-col min-h-[200px]">
            <div className="flex items-baseline justify-between px-1 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-lira-text">{col.title}</h3>
                <p className="text-2xs text-lira-muted">{col.hint}</p>
              </div>
              <span className="text-xs font-semibold text-lira-muted bg-lira-surface border border-lira-border rounded-full px-2 py-0.5">{list.length}</span>
            </div>
            <div className="space-y-2.5">
              {list.length === 0 && <div className="text-xs text-lira-muted italic px-1 py-3">Nothing here</div>}
              {list.map(({ item, progress, status }) => (
                <button
                  key={item.id}
                  onClick={() => onOpenItem(item.id)}
                  className="w-full text-left rounded-xl border border-lira-border bg-lira-surface p-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer"
                  style={{ borderLeft: `4px solid ${laneColor(roadmap, item.lane)}` }}
                >
                  <div className="text-3xs font-semibold uppercase tracking-wide" style={{ color: laneColor(roadmap, item.lane) }}>{item.lane}</div>
                  <div className="text-sm font-medium text-lira-text mt-0.5 leading-snug">{item.title}</div>
                  <div className="flex items-center gap-1.5 mt-2 text-2xs text-lira-muted">
                    <CalendarRange className="w-3 h-3" /> {fmtShort(item.start)} → {fmtShort(item.end)}
                    {item.deps.length > 0 && <span className="ml-auto flex items-center gap-1"><GitBranch className="w-3 h-3" />{item.deps.length}</span>}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-lira-border/60 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: STATUS_META[status].color }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: STATUS_META[status].color + '22', color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
                    <span className="text-2xs text-lira-muted tabular-nums">{progress}%</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
