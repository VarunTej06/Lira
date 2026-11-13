import { ChevronDown, ExternalLink, Target, Users } from 'lucide-react';
import type { IssueStatus } from '../../../types/issue';
import { Avatar } from '../../common/Avatar';
import { formatRelativeDate, formatTimeTracking } from '../../../utils/dateUtils';
import { BlockedToggle } from './BlockedToggle';
import { DetailRow } from './detailParts';
import { ASSIGNEE_OPTIONS, STATUS_OPTIONS } from './issueOptions';
import type { IssueDetailState } from './useIssueDetail';

const FIELD = 'w-full text-xs text-lira-text bg-white border border-lira-border hover:border-gray-400 rounded px-2 py-1 outline-none focus:border-lira-blue transition-colors cursor-pointer';
const KNOWN_ASSIGNEES = ['', 'VY', 'Varuntej Yadla', 'Alex Morgan', 'Sarah Connor', 'Dev Team'];

/** The status button and its menu, with the Blocked switch under it. */
export function StatusBlock(s: IssueDetailState) {
  const { local, showStatusMenu, setShowStatusMenu, statusMenuRef, statusStyle, patch, blockers, blocking, handleBlockedChange, onNavigateToIssue } = s;
  return (
    <div className="px-4 pt-4 pb-3 border-b border-lira-border space-y-2">
      <p id="issue-status-label" className="text-xs font-semibold text-lira-muted uppercase tracking-wider">Status</p>
      <div ref={statusMenuRef} className="relative">
        <button onClick={() => setShowStatusMenu(m => !m)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all w-full" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
          <span className="flex-1 text-left">{STATUS_OPTIONS.find(o => o.value === local.status)?.label ?? local.status}</span>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        </button>
        {showStatusMenu && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 animate-scale-in">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { patch({ status: opt.value as IssueStatus }); setShowStatusMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: opt.color, backgroundColor: opt.bgColor }}>{opt.label}</span>
                {local.status === opt.value && <span className="ml-auto text-lira-blue text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pt-2">
        <BlockedToggle issue={local} blocked={!!local.blocked} blockers={blockers} blocking={blocking} onChange={handleBlockedChange} onOpenIssue={onNavigateToIssue} />
      </div>
    </div>
  );
}

/** Which ticket this one sits under (epics are top level). */
export function ParentRow(s: IssueDetailState) {
  const { local, resolvedParent, eligibleParents, handleParentChange, onNavigateToIssue } = s;
  const icon = <Target className="w-3.5 h-3.5" />;
  if (local.type === 'epic') return <DetailRow icon={icon} label="Parent"><span className="text-xs text-lira-muted italic">Epics are top-level hierarchy containers</span></DetailRow>;
  return (
    <DetailRow icon={icon} label="Parent">
      <div className="flex items-center gap-1.5 w-full">
        <select
          value={local.parentId || (resolvedParent ? resolvedParent.id : '') || ''}
          onChange={e => handleParentChange(e.target.value ? Number(e.target.value) : undefined)}
          className={`${FIELD} truncate`}
          title="Select parent issue according to hierarchy"
        >
          <option value="">None (No parent)</option>
          {eligibleParents.map(p => <option key={p.id} value={p.id}>[{p.key}] {p.title} ({p.type})</option>)}
        </select>
        {resolvedParent && (
          <button type="button" onClick={() => onNavigateToIssue?.(resolvedParent)} className="p-1 hover:bg-gray-100 rounded text-lira-muted hover:text-lira-blue transition-colors flex-shrink-0" title={`Go to parent ${resolvedParent.key}`}>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </DetailRow>
  );
}

/** Who the ticket is assigned to. */
export function AssigneeRow({ local, patch }: Pick<IssueDetailState, 'local' | 'patch'>) {
  const change = (value: string) => {
    const match = ASSIGNEE_OPTIONS.find(o => o.value === value);
    patch({ assignee: value || undefined, assigneeInitials: match?.initials || (value ? value.slice(0, 2).toUpperCase() : undefined) });
  };
  return (
    <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Assignee">
      <div className="flex items-center gap-2 w-full">
        {local.assigneeInitials ? <Avatar initials={local.assigneeInitials} size="xs" /> : null}
        <select value={local.assignee === 'VY' ? 'Varuntej Yadla' : (local.assignee || '')} onChange={e => change(e.target.value)} className={FIELD}>
          {ASSIGNEE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          {local.assignee && !KNOWN_ASSIGNEES.includes(local.assignee) && <option value={local.assignee}>{local.assignee} ({local.assigneeInitials || 'User'})</option>}
        </select>
      </div>
    </DetailRow>
  );
}

/** Time logged against the estimate. */
export function TimeTracking({ logged = 0, estimate = 0 }: { logged?: number; estimate?: number }) {
  return (
    <div className="w-full">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div className="h-full rounded-full transition-all bg-lira-blue" style={{ width: `${Math.min(100, Math.round((logged / (estimate || 1)) * 100))}%` }} />
      </div>
      <div className="flex justify-between text-3xs text-lira-muted">
        <span>{formatTimeTracking(logged)} logged</span><span>{formatTimeTracking(estimate)} est.</span>
      </div>
    </div>
  );
}

/** When the ticket was created, updated and resolved. */
export function ActivityBox({ local }: Pick<IssueDetailState, 'local'>) {
  return (
    <div className="px-4 py-3 border-t border-lira-border">
      <p className="text-xs font-semibold text-lira-muted mb-3 uppercase tracking-wider">Activity</p>
      <div className="bg-white border border-lira-border rounded-lg p-3 space-y-2 text-xs text-lira-muted">
        <div className="flex justify-between"><span>Created</span><span>{formatRelativeDate(local.createdAt)}</span></div>
        <div className="flex justify-between"><span>Updated</span><span>{formatRelativeDate(local.updatedAt)}</span></div>
        {local.resolvedAt && <div className="flex justify-between"><span>Resolved</span><span>{formatRelativeDate(local.resolvedAt)}</span></div>}
        {local.epicLink && <div className="flex justify-between"><span>Epic</span><span className="text-purple-600 font-medium">{local.epicLink}</span></div>}
      </div>
    </div>
  );
}
