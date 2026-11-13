import { DatePicker } from '../../common/DatePicker';
import { AlertTriangle, Settings, Clock, Tag, Calendar, CheckSquare, Layers, Save, Users } from 'lucide-react';
import type { Priority, IssueType } from '../../../types/issue';
import { SelectDropdown } from '../../common/Dropdown';
import { Avatar } from '../../common/Avatar';
import { DetailRow, LabelAdder } from './detailParts';
import { ISSUE_TYPE_OPTIONS, PRIORITY_OPTIONS, safeArr, toDateInputValue } from './issueOptions';
import { ActivityBox, AssigneeRow, ParentRow, StatusBlock, TimeTracking } from './sidebarParts';
import type { IssueDetailState } from './useIssueDetail';
import { currentUser } from '../../../utils/currentUser';

const icon = (I: typeof Layers) => <I className="w-3.5 h-3.5" />;
const noonOf = (v: string) => (v ? new Date(`${v}T12:00:00`) : undefined);

/** Status, assignee, dates, labels and the other fields. */
export function IssueSidebar(s: IssueDetailState) {
  const { local, patch, handleTypeChange, handleSaveChanges } = s;
  return (
    <div className="w-full md:w-72 flex-shrink-0 border-t md:border-t-0 md:border-l border-lira-border md:overflow-y-auto bg-gray-50/40">
      <StatusBlock {...s} />

      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-lira-muted mb-3 uppercase tracking-wider flex items-center justify-between">
          Details<Settings className="w-3.5 h-3.5 cursor-pointer hover:text-lira-text" />
        </p>
        <div className="space-y-0">
          <DetailRow icon={icon(Layers)} label="Type">
            <SelectDropdown value={local.type} options={ISSUE_TYPE_OPTIONS} onChange={v => handleTypeChange(v as IssueType)} />
          </DetailRow>
          <ParentRow {...s} />
          <AssigneeRow local={local} patch={patch} />
          <DetailRow icon={icon(Calendar)} label="Due date">
            <DatePicker value={toDateInputValue(local.dueDate)} onChange={v => patch({ dueDate: noonOf(v) })} placeholder="No due date" aria-label="Due date" />
          </DetailRow>
          <DetailRow icon={icon(AlertTriangle)} label="Priority">
            <SelectDropdown value={local.priority} options={PRIORITY_OPTIONS} onChange={v => patch({ priority: v as Priority })} />
          </DetailRow>
          <DetailRow icon={icon(Tag)} label="Labels">
            <div className="flex flex-wrap gap-1">
              {safeArr(local.labels).map(label => (
                <span key={label} className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-lira-blue-light text-lira-text rounded-full font-medium">
                  {label}
                  <button onClick={() => patch({ labels: local.labels!.filter(l => l !== label) })} className="hover:text-red-500">×</button>
                </span>
              ))}
              <LabelAdder onAdd={l => patch({ labels: [...safeArr(local.labels), l] })} />
            </div>
          </DetailRow>
          {(local.timeEstimate || local.timeLogged) && (
            <DetailRow icon={icon(Clock)} label="Time tracking"><TimeTracking logged={local.timeLogged} estimate={local.timeEstimate} /></DetailRow>
          )}
          <DetailRow icon={icon(Calendar)} label="Start date">
            <DatePicker value={toDateInputValue(local.startDate)} onChange={v => patch({ startDate: noonOf(v) })} placeholder="No start date" aria-label="Start date" />
          </DetailRow>
          {local.category !== undefined && (
            <DetailRow icon={icon(Tag)} label="Category"><span className="text-sm text-lira-text">{local.category || 'Add option'}</span></DetailRow>
          )}
          <DetailRow icon={icon(Users)} label="Reporter">
            <div className="flex items-center gap-2">
              <Avatar initials={local.reporterInitials || currentUser().initials} size="xs" />
              <span className="text-sm text-lira-text">{local.reporter || local.reporterInitials || currentUser().initials}</span>
            </div>
          </DetailRow>
          <DetailRow icon={icon(CheckSquare)} label="Story points">
            <input
              type="number" min="0" max="100" value={local.storyPoints ?? ''} placeholder="None"
              onChange={e => patch({ storyPoints: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10)) })}
              className="w-20 px-2 py-1 text-xs border border-lira-border hover:border-gray-400 rounded bg-white text-lira-text outline-none focus:border-lira-blue transition-colors"
            />
          </DetailRow>
        </div>
      </div>

      <ActivityBox local={local} />

      <div className="p-4 border-t border-lira-border bg-white sticky bottom-0 z-10 shadow-xs space-y-2">
        {s.dirty && <p className="text-2xs text-amber-600 text-center" data-testid="unsaved-note">You have unsaved changes</p>}
        <button type="button" onClick={handleSaveChanges} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lira-blue hover:bg-lira-blue-hover text-lira-on-blue text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer">
          <Save className="w-4 h-4" />Save changes
        </button>
      </div>
    </div>
  );
}
