import { issueLink } from '../../../utils/links';
import { statusLabel } from '../../../utils/status';
import { TypeIcon, PriorityLabel } from '../../common/Icons';
import { Filter, ArrowUpDown } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import type { Issue } from '../../../types/issue';
import type { FiltersState } from './useFiltersState';
import { PALETTE } from '../../../theme/palette';

type SortField = Parameters<FiltersState['toggleSort']>[0];
type SpaceInfo = FiltersState['spaceMap'][number] | undefined;

/** The badge colour of each status; anything else is grey. */
const STATUS_BADGE: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  inprogress: 'bg-amber-100 text-amber-700',
  todo: 'bg-blue-100 text-blue-700',
};
const STATUS_BADGE_OTHER = 'bg-slate-100 text-slate-700';

/** Shown when the filters match nothing. */
function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <Filter className="w-8 h-8 text-lira-muted mx-auto mb-2 opacity-50" />
      <p className="text-sm font-semibold text-lira-text">No work items matched your filters</p>
      <p className="text-xs text-lira-muted mt-1 max-w-sm mx-auto">
        Try widening your search terms or clearing some of your status, priority, or space filters.
      </p>
      <button
        onClick={onReset}
        className="mt-4 px-4 py-2 bg-lira-blue text-lira-on-blue rounded-lg text-xs font-semibold hover:bg-lira-blue-hover transition-colors cursor-pointer"
      >
        Reset all filters
      </button>
    </div>
  );
}

/** A column heading that sorts the table when clicked. */
function SortHeading({ label, field, width, right, onSort }: { label: string; field: SortField; width?: string; right?: boolean; onSort: (field: SortField) => void }) {
  return (
    <th
      onClick={() => onSort(field)}
      className={`py-2.5 px-4 ${width ? `${width} ` : ''}cursor-pointer hover:text-lira-text${right ? ' text-right' : ''}`}
    >
      <span className={`flex items-center ${right ? 'justify-end ' : ''}gap-1`}>
        {label} <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );
}

/** The first three labels of a ticket, and how many more there are. */
function LabelChips({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {labels.slice(0, 3).map(l => (
        <span key={l} className="text-4xs bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">
          #{l}
        </span>
      ))}
      {labels.length > 3 && <span className="text-4xs text-gray-400">+{labels.length - 3}</span>}
    </div>
  );
}

/** The space of a ticket, in its own colour; clicking it opens that space's board. */
function SpaceButton({ space, spaceId, onSelectSpace }: { space: SpaceInfo; spaceId: number; onSelectSpace?: (spaceId: number) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (spaceId && onSelectSpace) onSelectSpace(spaceId);
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium hover:opacity-80 hover:ring-1 hover:ring-lira-blue transition-all cursor-pointer text-left"
      style={{
        backgroundColor: (space?.color || PALETTE.brand) + '15',
        color: space?.color || PALETTE.brand,
      }}
      title={`Open ${space?.name || 'Space'} board`}
    >
      <span>{space?.icon || '📁'}</span>
      <span className="truncate max-w-[100px]">{space?.name || 'Space'}</span>
    </button>
  );
}

function StatusCell({ issue }: { issue: Issue }) {
  return (
    <>
      <span className={`inline-block px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${STATUS_BADGE[issue.status] ?? STATUS_BADGE_OTHER}`}>
        {statusLabel(issue.status)}
      </span>
      {issue.blocked && <span className="ml-1 inline-block px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-red-100 text-red-700">Blocked</span>}
    </>
  );
}

function AssigneeCell({ issue }: { issue: Issue }) {
  return (
    <div className="flex items-center gap-1.5">
      <Avatar
        initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2) : 'UN')}
        size="xs"
        color={issue.assigneeInitials === 'VY' ? PALETTE.brand : PALETTE.textMuted}
      />
      <span className="truncate max-w-[80px] text-lira-text font-medium">{issue.assignee || 'Unassigned'}</span>
    </div>
  );
}

function ResultRow({ issue, space, onSelectIssue, onSelectSpace }: { issue: Issue; space: SpaceInfo; onSelectIssue: (issue: Issue) => void; onSelectSpace?: (spaceId: number) => void }) {
  return (
    <tr onClick={() => onSelectIssue(issue)} {...issueLink(issue)} className="hover:bg-lira-blue-light/40 transition-colors cursor-pointer group">
      <td className="py-3 px-4 text-center font-bold text-sm">
        <span className="inline-flex"><TypeIcon type={issue.type} className="w-4 h-4" /></span>
      </td>
      <td className="py-3 px-4 font-mono font-semibold text-lira-blue group-hover:underline">{issue.key}</td>
      <td className="py-3 px-4">
        <div className="font-medium text-lira-text leading-snug group-hover:text-lira-blue transition-colors">{issue.title}</div>
        {issue.labels && issue.labels.length > 0 && <LabelChips labels={issue.labels} />}
      </td>
      <td className="py-3 px-4"><SpaceButton space={space} spaceId={issue.spaceId} onSelectSpace={onSelectSpace} /></td>
      <td className="py-3 px-4"><StatusCell issue={issue} /></td>
      <td className="py-3 px-4 capitalize font-medium text-gray-600"><PriorityLabel priority={issue.priority} /></td>
      <td className="py-3 px-4"><AssigneeCell issue={issue} /></td>
      <td className="py-3 px-4 text-right text-gray-400 font-mono text-2xs">{new Date(issue.updatedAt || issue.createdAt).toLocaleDateString()}</td>
    </tr>
  );
}

/** The matching tickets. */
export function ResultsTable(s: FiltersState) {
  const { issues, onSelectIssue, onSelectSpace, clearAllFilters, spaceMap, filteredIssues, toggleSort } = s;
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="bg-white border border-lira-border rounded-xl shadow-xs overflow-hidden">
        <div className="bg-gray-50 border-b border-lira-border px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-lira-muted">
          <span>
            Showing <strong className="text-lira-text">{filteredIssues.length}</strong> of{' '}
            {issues.length} work items
          </span>
          <span className="text-gray-400">Click any ticket to open details</span>
        </div>

        {filteredIssues.length === 0 ? <EmptyResults onReset={clearAllFilters} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-lira-border bg-gray-50/60 text-lira-muted uppercase tracking-wider text-3xs">
                  <th className="py-2.5 px-4 w-12">Type</th>
                  <SortHeading label="Key" field="key" width="w-28" onSort={toggleSort} />
                  <SortHeading label="Summary" field="title" onSort={toggleSort} />
                  <th className="py-2.5 px-4 w-36">Space</th>
                  <SortHeading label="Status" field="status" width="w-28" onSort={toggleSort} />
                  <SortHeading label="Priority" field="priority" width="w-24" onSort={toggleSort} />
                  <th className="py-2.5 px-4 w-28">Assignee</th>
                  <SortHeading label="Updated" field="updatedAt" width="w-28" right onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredIssues.map(issue => (
                  <ResultRow key={issue.key} issue={issue} space={spaceMap[issue.spaceId]} onSelectIssue={onSelectIssue} onSelectSpace={onSelectSpace} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
