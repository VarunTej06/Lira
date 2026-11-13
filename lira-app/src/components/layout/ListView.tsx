import { issueLink } from '../../utils/links';
import { type SpaceFilters } from '../../utils/spaceFilters';
import { filterListIssues, pageWindow } from '../../utils/listView';
import { statusLabel } from '../../utils/status';
import { sortIssues, type SortField } from '../../utils/issueSort';
import { TypeIcon, PriorityLabel } from '../common/Icons';
import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, CheckSquare, Clock } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { Avatar } from '../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';

interface ListViewProps {
  issues: Issue[];
  space: Space | undefined;
  onSelectIssue: (issue: Issue) => void;
  searchQuery?: string;
  activeFilters?: SpaceFilters;
}

const COLUMNS: { field: SortField; label: string; width: string; centered?: boolean }[] = [
  { field: 'type', label: 'Type', width: 'w-12', centered: true },
  { field: 'key', label: 'Key', width: 'w-28' },
  { field: 'title', label: 'Title', width: 'min-w-[200px]' },
  { field: 'status', label: 'Status', width: 'w-28' },
  { field: 'priority', label: 'Priority', width: 'w-28' },
  { field: 'assignee', label: 'Assignee', width: 'w-36' },
  { field: 'dueDate', label: 'Due Date', width: 'w-32' },
];

const STATUS_BADGE: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inprogress: 'bg-amber-100 text-amber-800 border-amber-200',
  todo: 'bg-blue-100 text-blue-800 border-blue-200',
};
const DEFAULT_BADGE = 'bg-slate-100 text-slate-700 border-slate-200';
const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const PAGE_SIZES = [10, 15, 25, 50];
const strong = 'font-semibold text-gray-800';
const pagerButton = 'flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-gray-700';

/** The search box (when the page has none of its own) and "N issues in Space". */
function ListSearchBar({ value, onChange, total, spaceName }: { value: string; onChange: (value: string) => void; total: number; spaceName?: string }) {
  return (
    <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-4 bg-gray-50/50">
      <div className="relative max-w-sm w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter list by key, title, assignee..."
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lira-blue focus:border-lira-blue"
        />
      </div>
      <div className="text-xs text-gray-500 font-medium">{total} {total === 1 ? 'issue' : 'issues'} {spaceName ? `in ${spaceName}` : ''}</div>
    </div>
  );
}

/** One ticket as a table row. */
function ListRow({ issue, onSelect }: { issue: Issue; onSelect: (issue: Issue) => void }) {
  return (
    <tr onClick={() => onSelect(issue)} {...issueLink(issue)} className="hover:bg-lira-blue-light/50 transition-colors cursor-pointer group">
      <td className="py-2.5 px-3 text-center text-sm">
        <span title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type} className="inline-flex"><TypeIcon type={issue.type} className="w-4 h-4" /></span>
      </td>
      <td className="py-2.5 px-3 font-mono font-semibold text-lira-blue group-hover:underline whitespace-nowrap">{issue.key}</td>
      <td className="py-2.5 px-3">
        <div className="font-medium text-gray-900 group-hover:text-lira-blue transition-colors line-clamp-1">{issue.title}</div>
        {issue.labels?.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {issue.labels.slice(0, 3).map(l => <span key={l} className="text-3xs bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">#{l}</span>)}
            {issue.labels.length > 3 && <span className="text-3xs text-gray-400">+{issue.labels.length - 3}</span>}
          </div>
        )}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <span className={`inline-block px-2 py-0.5 rounded text-2xs font-semibold border capitalize ${STATUS_BADGE[issue.status] ?? DEFAULT_BADGE}`}>{statusLabel(issue.status)}</span>
        {issue.blocked && <span className="ml-1 inline-block px-2 py-0.5 rounded text-2xs font-semibold border bg-red-100 text-red-800 border-red-200">Blocked</span>}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        {PRIORITIES.includes(issue.priority) ? <PriorityLabel priority={issue.priority} /> : <span className="text-gray-500 capitalize">{issue.priority}</span>}
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Avatar initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN')} size="xs" />
          <span className="truncate max-w-[100px] text-gray-700">{issue.assignee || 'Unassigned'}</span>
        </div>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">
        {issue.dueDate ? (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            {new Date(issue.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        ) : <span className="text-gray-400 italic">None</span>}
      </td>
    </tr>
  );
}

function EmptyRows({ searching }: { searching: boolean }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className="py-12 text-center text-gray-500">
        <div className="flex flex-col items-center justify-center gap-2">
          <CheckSquare className="w-8 h-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No issues found</p>
          <p className="text-xs text-gray-400">{searching ? 'Try adjusting your search criteria' : 'Create an issue to get started'}</p>
        </div>
      </td>
    </tr>
  );
}

/** The arrow in a column heading: faint until hovered, blue and pointing the way when it is the sorted column. */
function SortIndicator({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
  return asc ? <ArrowUp className="w-3.5 h-3.5 text-lira-blue" /> : <ArrowDown className="w-3.5 h-3.5 text-lira-blue" />;
}

/** Rows per page, "Showing a–b of n", and Prev / Next. */
function Pager({ total, win, pageSize, onPageSize, onPage }: { total: number; win: ReturnType<typeof pageWindow>; pageSize: number; onPageSize: (size: number) => void; onPage: (update: (page: number) => number) => void }) {
  return (
    <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4 text-xs select-none">
      <div className="flex items-center gap-2 text-gray-600">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-lira-blue cursor-pointer"
        >
          {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="ml-2 text-gray-500">
          {total > 0 ? <>Showing <span className={strong}>{win.start + 1}</span>–<span className={strong}>{win.end}</span> of <span className={strong}>{total}</span></> : '0 issues'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onPage(p => Math.max(1, p - 1))} disabled={win.current <= 1} className={pagerButton}><ChevronLeft className="w-3.5 h-3.5" /><span>Prev</span></button>
        <span className="px-2 text-gray-600 font-medium">Page {win.current} of {win.totalPages}</span>
        <button onClick={() => onPage(p => Math.min(win.totalPages, p + 1))} disabled={win.current >= win.totalPages} className={pagerButton}><span>Next</span><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

export const ListView: React.FC<ListViewProps> = ({ issues, space, onSelectIssue, searchQuery = '', activeFilters }) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const search = (searchQuery || internalSearch).trim().toLowerCase();
  const sortedIssues = useMemo(() => sortIssues(filterListIssues(issues, search, activeFilters), sortField, sortAsc), [issues, search, activeFilters, sortField, sortAsc]);
  const totalItems = sortedIssues.length;
  const win = pageWindow(totalItems, page, pageSize);

  const sortBy = (field: SortField) => {
    if (sortField === field) setSortAsc(prev => !prev);
    else { setSortField(field); setSortAsc(true); }
    setPage(1);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Own search box, shown when the page has no search of its own */}
      {!searchQuery && <ListSearchBar value={internalSearch} onChange={v => { setInternalSearch(v); setPage(1); }} total={totalItems} spaceName={space?.name} />}

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
            <tr>
              {COLUMNS.map(({ field, label, width, centered }) => (
                <th key={field} onClick={() => sortBy(field)} title={`Sort by ${label.toLowerCase()}`} className={`py-2.5 px-3 font-semibold text-gray-700 cursor-pointer select-none group ${width} ${centered ? 'text-center' : ''}`}>
                  <div className={`flex items-center gap-1 ${centered ? 'justify-center' : ''}`}><span>{label}</span><SortIndicator active={sortField === field} asc={sortAsc} /></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {totalItems === 0
              ? <EmptyRows searching={!!search} />
              : sortedIssues.slice(win.start, win.end).map(issue => <ListRow key={issue.id || issue.key} issue={issue} onSelect={onSelectIssue} />)}
          </tbody>
        </table>
      </div>

      <Pager total={totalItems} win={win} pageSize={pageSize} onPageSize={size => { setPageSize(size); setPage(1); }} onPage={setPage} />
    </div>
  );
};
