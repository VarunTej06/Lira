import { BlockedToggle } from './BlockedToggle';
import { DatePicker } from '../../common/DatePicker';
import { ChevronDown, AlertTriangle, Settings, Clock, Tag, Users, Calendar, CheckSquare, ExternalLink, Target, Layers, Save } from 'lucide-react';
import type { Priority, IssueType, IssueStatus } from '../../../types/issue';
import { SelectDropdown } from '../../common/Dropdown';
import { Avatar } from '../../common/Avatar';
import { formatRelativeDate, formatTimeTracking } from '../../../utils/dateUtils';
import { DetailRow, LabelAdder } from './detailParts';
import { STATUS_OPTIONS, ISSUE_TYPE_OPTIONS, PRIORITY_OPTIONS, ASSIGNEE_OPTIONS, safeArr, toDateInputValue } from './useIssueDetail';
import type { IssueDetailState } from './useIssueDetail';

/** Status, assignee, dates, labels and the other fields. */
export function IssueSidebar(s: IssueDetailState) {
  const {  onNavigateToIssue, local, showStatusMenu, setShowStatusMenu, statusMenuRef, resolvedParent, eligibleParents, patch, handleTypeChange, handleParentChange, handleSaveChanges, statusStyle, blockers, blocking, handleBlockedChange } = s;
  return (
    <>
          {/* ── RIGHT: Details sidebar ── */}
          <div className="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-l border-lira-border md:overflow-y-auto bg-gray-50/40">
            {/* Status button — prominent at the top */}
            <div className="px-4 pt-4 pb-3 border-b border-lira-border space-y-2">
              <p id="issue-status-label" className="text-xs font-semibold text-lira-muted uppercase tracking-wider">Status</p>
              <div ref={statusMenuRef} className="relative">
                <button
                  onClick={() => setShowStatusMenu(m => !m)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all w-full"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  <span className="flex-1 text-left">{STATUS_OPTIONS.find(s => s.value === local.status)?.label ?? local.status}</span>
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 animate-scale-in">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { patch({ status: opt.value as IssueStatus }); setShowStatusMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: opt.color, backgroundColor: opt.bgColor }}>
                          {opt.label}
                        </span>
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

            {/* Details section */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-lira-muted mb-3 uppercase tracking-wider flex items-center justify-between">
                Details
                <Settings className="w-3.5 h-3.5 cursor-pointer hover:text-lira-text" />
              </p>

              <div className="space-y-0">
                {/* Type Selector */}
                <DetailRow icon={<Layers className="w-3.5 h-3.5" />} label="Type">
                  <SelectDropdown
                    value={local.type}
                    options={ISSUE_TYPE_OPTIONS}
                    onChange={v => handleTypeChange(v as IssueType)}
                  />
                </DetailRow>

                {/* Parent in Hierarchy */}
                {local.type !== 'epic' ? (
                  <DetailRow icon={<Target className="w-3.5 h-3.5" />} label="Parent">
                    <div className="flex items-center gap-1.5 w-full">
                      <select
                        value={local.parentId || (resolvedParent ? resolvedParent.id : '') || ''}
                        onChange={e => {
                          const val = e.target.value;
                          handleParentChange(val ? Number(val) : undefined);
                        }}
                        className="w-full text-xs text-lira-text bg-white border border-lira-border hover:border-gray-400 rounded px-2 py-1 outline-none focus:border-lira-blue transition-colors cursor-pointer truncate"
                        title="Select parent issue according to hierarchy"
                      >
                        <option value="">None (No parent)</option>
                        {eligibleParents.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.key}] {p.title} ({p.type})
                          </option>
                        ))}
                      </select>
                      {resolvedParent && (
                        <button
                          type="button"
                          onClick={() => onNavigateToIssue?.(resolvedParent)}
                          className="p-1 hover:bg-gray-100 rounded text-lira-muted hover:text-lira-blue transition-colors flex-shrink-0"
                          title={`Go to parent ${resolvedParent.key}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </DetailRow>
                ) : (
                  <DetailRow icon={<Target className="w-3.5 h-3.5" />} label="Parent">
                    <span className="text-xs text-lira-muted italic">Epics are top-level hierarchy containers</span>
                  </DetailRow>
                )}

                <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Assignee">
                  <div className="flex items-center gap-2 w-full">
                    {local.assigneeInitials ? (
                      <Avatar initials={local.assigneeInitials} size="xs" />
                    ) : null}
                    <select
                      value={
                        local.assignee === 'VY'
                          ? 'Varuntej Yadla'
                          : (local.assignee || '')
                      }
                      onChange={e => {
                        const val = e.target.value;
                        const match = ASSIGNEE_OPTIONS.find(o => o.value === val);
                        const initials = match?.initials || (val ? val.slice(0, 2).toUpperCase() : undefined);
                        patch({
                          assignee: val || undefined,
                          assigneeInitials: initials,
                        });
                      }}
                      className="w-full text-xs text-lira-text bg-white border border-lira-border hover:border-gray-400 rounded px-2 py-1 outline-none focus:border-lira-blue transition-colors cursor-pointer"
                    >
                      {ASSIGNEE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      {local.assignee && !['', 'VY', 'Varuntej Yadla', 'Alex Morgan', 'Sarah Connor', 'Dev Team'].includes(local.assignee) && (
                        <option value={local.assignee}>{local.assignee} ({local.assigneeInitials || 'User'})</option>
                      )}
                    </select>
                  </div>
                </DetailRow>

                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Due date">
                  <DatePicker
                    value={toDateInputValue(local.dueDate)}
                    onChange={v => patch({ dueDate: v ? new Date(`${v}T12:00:00`) : undefined })}
                    placeholder="No due date"
                    aria-label="Due date"
                  />
                </DetailRow>

                <DetailRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Priority">
                  <SelectDropdown
                    value={local.priority}
                    options={PRIORITY_OPTIONS}
                    onChange={v => patch({ priority: v as Priority })}
                  />
                </DetailRow>

                <DetailRow icon={<Tag className="w-3.5 h-3.5" />} label="Labels">
                  <div className="flex flex-wrap gap-1">
                    {safeArr(local.labels).map(label => (
                      <span key={label} className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full font-medium">
                        {label}
                        <button onClick={() => patch({ labels: local.labels!.filter(l => l !== label) })} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                    <LabelAdder onAdd={l => patch({ labels: [...safeArr(local.labels), l] })} />
                  </div>
                </DetailRow>

                {/* Time tracking */}
                {(local.timeEstimate || local.timeLogged) && (
                  <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Time tracking">
                    <div className="w-full">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((local.timeLogged ?? 0) / (local.timeEstimate ?? 1)) * 100))}%`,
                            backgroundColor: '#0052CC',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-lira-muted">
                        <span>{formatTimeTracking(local.timeLogged ?? 0)} logged</span>
                        <span>{formatTimeTracking(local.timeEstimate ?? 0)} est.</span>
                      </div>
                    </div>
                  </DetailRow>
                )}

                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Start date">
                  <DatePicker
                    value={toDateInputValue(local.startDate)}
                    onChange={v => patch({ startDate: v ? new Date(`${v}T12:00:00`) : undefined })}
                    placeholder="No start date"
                    aria-label="Start date"
                  />
                </DetailRow>

                {local.category !== undefined && (
                  <DetailRow icon={<Tag className="w-3.5 h-3.5" />} label="Category">
                    <span className="text-sm text-lira-text">{local.category || 'Add option'}</span>
                  </DetailRow>
                )}

                <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Reporter">
                  <div className="flex items-center gap-2">
                    <Avatar initials={local.reporterInitials || 'VY'} size="xs" />
                    <span className="text-sm text-lira-text">{local.reporter || local.reporterInitials || 'VY'}</span>
                  </div>
                </DetailRow>

                <DetailRow icon={<CheckSquare className="w-3.5 h-3.5" />} label="Story points">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={local.storyPoints ?? ''}
                    placeholder="None"
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10));
                      patch({ storyPoints: val });
                    }}
                    className="w-20 px-2 py-1 text-xs border border-lira-border hover:border-gray-400 rounded bg-white text-lira-text outline-none focus:border-lira-blue transition-colors"
                  />
                </DetailRow>
              </div>
            </div>

            {/* Metadata */}
            <div className="px-4 py-3 border-t border-lira-border">
              <p className="text-xs font-semibold text-lira-muted mb-3 uppercase tracking-wider">Activity</p>
              <div className="bg-white border border-lira-border rounded-lg p-3 space-y-2 text-xs text-lira-muted">
                <div className="flex justify-between"><span>Created</span><span>{formatRelativeDate(local.createdAt)}</span></div>
                <div className="flex justify-between"><span>Updated</span><span>{formatRelativeDate(local.updatedAt)}</span></div>
                {local.resolvedAt && <div className="flex justify-between"><span>Resolved</span><span>{formatRelativeDate(local.resolvedAt)}</span></div>}
                {local.epicLink && (
                  <div className="flex justify-between">
                    <span>Epic</span>
                    <span className="text-purple-600 font-medium">{local.epicLink}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Save changes button */}
            <div className="p-4 border-t border-lira-border bg-white sticky bottom-0 z-10 shadow-xs space-y-2">
              {s.dirty && <p className="text-[11px] text-amber-600 text-center" data-testid="unsaved-note">You have unsaved changes</p>}
              <button
                type="button"
                onClick={handleSaveChanges}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lira-blue hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save changes
              </button>
            </div>
          </div>
    </>
  );
}
