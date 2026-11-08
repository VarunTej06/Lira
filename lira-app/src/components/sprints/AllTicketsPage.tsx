import React, { useMemo, useState } from 'react';
import { Search, Ticket, CalendarClock } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { allSprintKeys, currentSprintKey, getIssueSprint, sprintLabel } from '../../utils/sprintUtils';
import { SprintSelect, STATUS_META, TicketRow } from './sprintParts';

interface AllTicketsPageProps {
  spaces: Space[];
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onOpenSprints?: () => void;
}

const PAGE_SIZE = 100;

/** Every ticket across every space and every sprint, in one searchable list. */
export const AllTicketsPage: React.FC<AllTicketsPageProps> = ({ spaces, issues, onIssueClick, onOpenSprints }) => {
  const [query, setQuery] = useState('');
  const [spaceId, setSpaceId] = useState<'all' | number>('all');
  const [sprint, setSprint] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [groupBySprint, setGroupBySprint] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const spaceById = useMemo(() => new Map(spaces.map(s => [s.id!, s])), [spaces]);
  const keys = useMemo(() => allSprintKeys(issues), [issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues
      .filter(i => spaceId === 'all' || i.spaceId === spaceId)
      .filter(i => sprint === 'all' || (i.type !== 'epic' && getIssueSprint(i) === sprint) || (sprint === 'epics' && i.type === 'epic'))
      .filter(i => status === 'all' || i.status?.toLowerCase() === status)
      .filter(i => type === 'all' || i.type === type)
      .filter(i => !q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || (i.labels || []).some(l => l.toLowerCase().includes(q)))
      .sort((a, b) => getIssueSprint(b).localeCompare(getIssueSprint(a)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [issues, query, spaceId, sprint, status, type]);

  const visible = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const map = new Map<string, Issue[]>();
    visible.forEach(i => {
      const k = i.type === 'epic' ? 'epic' : getIssueSprint(i);
      map.set(k, [...(map.get(k) || []), i]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => (a === 'epic' ? 1 : b === 'epic' ? -1 : b.localeCompare(a)));
  }, [visible]);

  const carried = filtered.filter(i => (i.sprintHistory || []).length > 0).length;
  const sel = 'text-sm border border-lira-border rounded-md px-2.5 py-1.5 bg-white text-lira-text cursor-pointer';

  const renderRow = (i: Issue) => (
    <TicketRow
      key={i.id}
      issue={i}
      space={spaceById.get(i.spaceId)}
      showSpace={spaceId === 'all'}
      showSprint={!groupBySprint && i.type !== 'epic'}
      sprintOptions={keys}
      onClick={onIssueClick}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto bg-lira-bg">
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2">
              <Ticket className="w-5 h-5 text-lira-blue" /> All tickets
            </h1>
            <p className="text-xs text-lira-muted mt-0.5">
              {issues.length} tickets across {spaces.length} spaces and every sprint · {carried} carried over
            </p>
          </div>
          {onOpenSprints && (
            <button onClick={onOpenSprints} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-lira-border rounded-md bg-white text-lira-text hover:bg-gray-50 cursor-pointer">
              <CalendarClock className="w-4 h-4" /> Sprint planning
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-lira-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
              placeholder="Search key, title or label"
              className="text-sm border border-lira-border rounded-md pl-8 pr-3 py-1.5 w-64 bg-white text-lira-text focus:outline-none focus:ring-1 focus:ring-lira-blue"
            />
          </div>
          <select className={sel} value={spaceId} onChange={e => { setSpaceId(e.target.value === 'all' ? 'all' : Number(e.target.value)); setLimit(PAGE_SIZE); }} aria-label="Space">
            <option value="all">All spaces</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
          <SprintSelect value={sprint} options={keys} onChange={v => { setSprint(v); setLimit(PAGE_SIZE); }} allLabel="All sprints" className="!text-sm !px-2.5 !py-1.5 !rounded-md" />
          <select className={sel} value={status} onChange={e => { setStatus(e.target.value); setLimit(PAGE_SIZE); }} aria-label="Status">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className={sel} value={type} onChange={e => { setType(e.target.value); setLimit(PAGE_SIZE); }} aria-label="Type">
            <option value="all">All types</option>
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="subtask">Subtask</option>
            <option value="epic">Epic</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-lira-muted cursor-pointer ml-auto">
            <input type="checkbox" checked={groupBySprint} onChange={e => setGroupBySprint(e.target.checked)} /> Group by sprint
          </label>
        </div>

        <p className="text-xs text-lira-muted">
          Showing {visible.length} of {filtered.length}
          {sprint === currentSprintKey() && ' (current sprint)'}
        </p>

        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-lira-border rounded-lg py-12 text-center text-sm text-lira-muted">No tickets match these filters.</div>
        ) : groupBySprint ? (
          groups.map(([k, rows]) => (
            <div key={k} className="bg-white border border-lira-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
                <span className="text-xs font-semibold text-lira-text">{k === 'epic' ? 'Epics (outside sprints)' : `${sprintLabel(k)} Sprint`}</span>
                {k === currentSprintKey() && <span className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5 font-semibold">ACTIVE</span>}
                <span className="text-xs text-lira-muted">{rows.length}</span>
              </div>
              {rows.map(renderRow)}
            </div>
          ))
        ) : (
          <div className="bg-white border border-lira-border rounded-lg overflow-hidden">{visible.map(renderRow)}</div>
        )}

        {filtered.length > visible.length && (
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="w-full text-sm py-2 border border-lira-border rounded-md bg-white hover:bg-gray-50 text-lira-text cursor-pointer">
            Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
          </button>
        )}
      </div>
    </div>
  );
};
