import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import type { Issue } from '../../types/issue';
import {
  STATUS_META, dependencyIssues, fmtShort, laneColor, resolveItem,
  type Roadmap, type RoadmapItem,
} from '../../utils/roadmapUtils';

type SortKey = 'title' | 'lane' | 'status' | 'start' | 'end' | 'progress' | 'owner';
interface Props { roadmap: Roadmap; items: RoadmapItem[]; issues: Issue[]; onOpenItem: (id: string) => void }

/** Sortable table of every roadmap item with progress, dates, dependencies and problems. */
export const RoadmapTable: React.FC<Props> = ({ roadmap, items, issues, onOpenItem }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'start', dir: 1 });
  const today = new Date();
  const problems = useMemo(() => dependencyIssues(roadmap.items), [roadmap.items]);
  const titleOf = new Map(roadmap.items.map(i => [i.id, i.title]));

  const rows = useMemo(() => items.map(i => {
    const { progress, status, epic } = resolveItem(i, issues, today);
    return { item: i, progress, status, epic };
  }).sort((a, b) => {
    const v = (r: typeof a) => sort.key === 'progress' ? r.progress : sort.key === 'status' ? r.status : String(r.item[sort.key] ?? '');
    const x = v(a), y = v(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, issues, sort]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`px-3 py-2.5 text-left font-semibold ${cls}`}>
      <button onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} className="flex items-center gap-1 cursor-pointer hover:text-lira-text">
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  );

  return (
    <div className="rounded-2xl border border-lira-border bg-lira-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-lira-bg/70 text-lira-muted uppercase tracking-wider text-3xs border-b border-lira-border">
            <tr>
              {th('title', 'Epic', 'min-w-[260px]')}{th('lane', 'Lane')}{th('status', 'Status')}{th('start', 'Start')}{th('end', 'End')}{th('progress', 'Progress', 'min-w-[130px]')}{th('owner', 'Owner')}
              <th className="px-3 py-2.5 text-left font-semibold">Depends on</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-lira-muted">No items match the filters</td></tr>}
            {rows.map(({ item, progress, status, epic }) => {
              const conflict = problems.some(p => p.to === item.id && p.kind === 'conflict');
              return (
                <tr key={item.id} onClick={() => onOpenItem(item.id)} className="border-b border-lira-border/60 hover:bg-lira-bg/60 cursor-pointer">
                  <td className="px-3 py-2.5 text-lira-text font-medium"><span className="font-mono text-3xs text-lira-muted mr-2">{epic?.key || item.epicKey || '—'}</span>{item.title}</td>
                  <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: laneColor(roadmap, item.lane) }} />{item.lane}</span></td>
                  <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full font-semibold text-3xs" style={{ background: STATUS_META[status].color + '22', color: STATUS_META[status].color }}>{STATUS_META[status].label}</span></td>
                  <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{fmtShort(item.start)}</td>
                  <td className="px-3 py-2.5 text-lira-muted whitespace-nowrap">{fmtShort(item.end)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-lira-border/60 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress}%`, background: STATUS_META[status].color }} /></div>
                      <span className="tabular-nums text-lira-muted w-8 text-right">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-lira-muted">{item.owner || '—'}</td>
                  <td className="px-3 py-2.5 text-lira-muted">
                    {item.deps.length === 0 ? '—' : (
                      <span className="inline-flex items-center gap-1">
                        {conflict && <AlertTriangle className="w-3 h-3 text-red-500" />}
                        {item.deps.map(d => titleOf.get(d)?.split(':')[0] || d).join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
