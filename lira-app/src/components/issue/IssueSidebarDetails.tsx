import React, { useState } from 'react';
import type { Issue, Priority, IssueStatus } from '../../types/issue';
import { SelectDropdown } from '../common/Dropdown';
import { Avatar } from '../common/Avatar';
import { Calendar, Tag, Clock, Users, Layers, AlertCircle } from 'lucide-react';
import { formatTimeTracking, formatRelativeDate } from '../../utils/dateUtils';
import { PRIORITY_CONFIG } from '../../utils/priorityUtils';

interface IssueSidebarDetailsProps {
  issue: Issue;
  onUpdate: (changes: Partial<Issue>) => void;
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog', color: '#6B778C', bgColor: '#F4F5F7' },
  { value: 'todo', label: 'To Do', color: '#172B4D', bgColor: '#DFE1E6' },
  { value: 'inprogress', label: 'In Progress', color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'done', label: 'Done', color: '#006644', bgColor: '#E3FCEF' },
];

const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: <span>{cfg.icon}</span>,
  color: cfg.color,
  bgColor: cfg.bgColor,
}));

interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const FieldRow: React.FC<FieldRowProps> = ({ icon, label, children }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
    <div className="flex items-center gap-1.5 w-28 flex-shrink-0 text-xs text-jira-muted mt-1.5">
      <span className="text-jira-muted">{icon}</span>
      {label}
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

export const IssueSidebarDetails: React.FC<IssueSidebarDetailsProps> = ({ issue, onUpdate }) => {
  const timePercent = issue.timeEstimate && issue.timeLogged
    ? Math.min(100, Math.round((issue.timeLogged / issue.timeEstimate) * 100))
    : 0;

  return (
    <div className="space-y-1">
      {/* Status */}
      <FieldRow icon={<AlertCircle className="w-3.5 h-3.5" />} label="Status">
        <SelectDropdown
          value={issue.status}
          options={STATUS_OPTIONS}
          onChange={v => onUpdate({ status: v as IssueStatus })}
        />
      </FieldRow>

      {/* Assignee */}
      <FieldRow icon={<Users className="w-3.5 h-3.5" />} label="Assignee">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm hover:bg-gray-50 cursor-pointer">
          {issue.assigneeInitials ? (
            <>
              <Avatar initials={issue.assigneeInitials} size="xs" color="#0052CC" />
              <span className="text-jira-text">{issue.assignee || issue.assigneeInitials}</span>
            </>
          ) : (
            <span className="text-jira-muted">Unassigned</span>
          )}
        </div>
      </FieldRow>

      {/* Reporter */}
      <FieldRow icon={<Users className="w-3.5 h-3.5" />} label="Reporter">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm">
          <Avatar initials={issue.reporterInitials} size="xs" />
          <span className="text-jira-text">{issue.reporter || issue.reporterInitials}</span>
        </div>
      </FieldRow>

      {/* Priority */}
      <FieldRow icon={<Layers className="w-3.5 h-3.5" />} label="Priority">
        <SelectDropdown
          value={issue.priority}
          options={PRIORITY_OPTIONS}
          onChange={v => onUpdate({ priority: v as Priority })}
        />
      </FieldRow>

      {/* Due Date */}
      <FieldRow icon={<Calendar className="w-3.5 h-3.5" />} label="Due date">
        <div className="px-2.5 py-1.5 rounded text-sm hover:bg-gray-50 cursor-pointer">
          <input
            type="date"
            value={issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : ''}
            onChange={e => onUpdate({ dueDate: e.target.value ? new Date(e.target.value) : undefined })}
            className="text-sm text-jira-text border-none outline-none bg-transparent cursor-pointer"
          />
        </div>
      </FieldRow>

      {/* Start Date */}
      <FieldRow icon={<Calendar className="w-3.5 h-3.5" />} label="Start date">
        <div className="px-2.5 py-1.5 rounded text-sm hover:bg-gray-50 cursor-pointer">
          <input
            type="date"
            value={issue.startDate ? new Date(issue.startDate).toISOString().split('T')[0] : ''}
            onChange={e => onUpdate({ startDate: e.target.value ? new Date(e.target.value) : undefined })}
            className="text-sm text-jira-text border-none outline-none bg-transparent cursor-pointer"
          />
        </div>
      </FieldRow>

      {/* Labels */}
      <FieldRow icon={<Tag className="w-3.5 h-3.5" />} label="Labels">
        <div className="flex flex-wrap gap-1 px-1 py-1">
          {issue.labels.map(label => (
            <span
              key={label}
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full font-medium"
            >
              {label}
              <button
                onClick={() => onUpdate({ labels: issue.labels.filter(l => l !== label) })}
                className="hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          <LabelAdder onAdd={label => onUpdate({ labels: [...issue.labels, label] })} />
        </div>
      </FieldRow>

      {/* Time Tracking */}
      {(issue.timeEstimate || issue.timeLogged) && (
        <FieldRow icon={<Clock className="w-3.5 h-3.5" />} label="Time">
          <div className="px-2.5 py-2">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${timePercent}%`, backgroundColor: timePercent >= 100 ? '#DE350B' : '#0052CC' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-jira-muted">
              <span>{formatTimeTracking(issue.timeLogged || 0)} logged</span>
              <span>{formatTimeTracking(issue.timeEstimate || 0)} estimated</span>
            </div>
          </div>
        </FieldRow>
      )}

      {/* Category */}
      {issue.category && (
        <FieldRow icon={<Tag className="w-3.5 h-3.5" />} label="Category">
          <span className="px-2.5 py-1.5 text-sm text-jira-text">{issue.category}</span>
        </FieldRow>
      )}

      {/* Automation & metadata */}
      <div className="mt-4 pt-4 border-t border-jira-border">
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-jira-muted mb-2">Metadata</p>
          <div className="text-xs text-jira-muted space-y-1">
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-jira-text">{formatRelativeDate(issue.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-jira-text">{formatRelativeDate(issue.updatedAt)}</span>
            </div>
            {issue.resolvedAt && (
              <div className="flex justify-between">
                <span>Resolved</span>
                <span className="text-jira-text">{formatRelativeDate(issue.resolvedAt)}</span>
              </div>
            )}
            {issue.storyPoints && (
              <div className="flex justify-between">
                <span>Story points</span>
                <span className="text-jira-text font-semibold">{issue.storyPoints}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Inline label adder
const LabelAdder: React.FC<{ onAdd: (label: string) => void }> = ({ onAdd }) => {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (value.trim()) { onAdd(value.trim()); setValue(''); }
    setAdding(false);
  };

  if (adding) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setAdding(false); }}
        onBlur={handleSubmit}
        className="text-xs border border-jira-blue rounded-full px-2 py-0.5 outline-none w-20"
        placeholder="label"
      />
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="px-2 py-0.5 text-xs text-jira-muted hover:text-jira-blue border border-dashed border-jira-border hover:border-jira-blue rounded-full transition-colors"
    >
      + Add
    </button>
  );
};
