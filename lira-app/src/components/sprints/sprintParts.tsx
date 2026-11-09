import { issueLink } from '../../utils/links';
import { BLOCKED_META } from '../../utils/status';
import { TypeIcon, PriorityIcon } from '../common/Icons';
import React from 'react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { getPriorityConfig } from '../../utils/priorityUtils';
import { Avatar } from '../common/Avatar';
import {
  getIssueSprint, sprintLabel, sprintPhase, sprintName, moveIssuesToSprint, currentSprintKey, nextSprint,
} from '../../utils/sprintUtils';
import { statusMeta } from './statusMeta';


export const PhaseBadge: React.FC<{ sprint: string }> = ({ sprint }) => {
  const phase = sprintPhase(sprint);
  const cfg = {
    active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
    past: { label: 'Completed period', cls: 'bg-gray-100 text-gray-600' },
    upcoming: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' },
  }[phase];
  return <span className={`text-3xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>;
};

export const SprintChip: React.FC<{ sprint: string; carried?: boolean }> = ({ sprint, carried }) => (
  <span
    title={sprintName(sprint)}
    className="inline-flex items-center gap-1 text-3xs font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 whitespace-nowrap"
  >
    {sprintLabel(sprint, true)}
    {carried && <span title="Carried over from an earlier sprint">↻</span>}
  </span>
);

/** Native select listing sprints; used to reassign a ticket or to filter. */
export const SprintSelect: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  allLabel?: string;
  className?: string;
  title?: string;
}> = ({ value, options, onChange, allLabel, className = '', title }) => {
  const cur = currentSprintKey();
  return (
    <select
      title={title}
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`text-xs border border-lira-border rounded px-2 py-1 bg-white text-lira-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-lira-blue ${className}`}
    >
      {allLabel && <option value="all">{allLabel}</option>}
      {[...options].reverse().map(k => (
        <option key={k} value={k}>
          {sprintLabel(k)}{k === cur ? ' (current)' : ''}
        </option>
      ))}
    </select>
  );
};

interface TicketRowProps {
  issue: Issue;
  space?: Space;
  showSpace?: boolean;
  sprintOptions: string[];
  selected?: boolean;
  onToggleSelect?: (issue: Issue) => void;
  onClick: (issue: Issue) => void;
  showSprint?: boolean;
}

export const TicketRow: React.FC<TicketRowProps> = ({
  issue, space, showSpace, sprintOptions, selected, onToggleSelect, onClick, showSprint,
}) => {
  const type = ISSUE_TYPE_CONFIG[issue.type] ?? ISSUE_TYPE_CONFIG.task;
  const pri = getPriorityConfig(issue.priority);
  const st = statusMeta(issue.status);
  const sprint = getIssueSprint(issue);
  const carried = (issue.sprintHistory || []).length > 0;

  return (
    <div
      onClick={() => onClick(issue)} {...issueLink(issue)}
      className={`flex items-center gap-3 px-3 py-2 border-b border-lira-border last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${
        selected ? 'bg-blue-50' : ''
      }`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect(issue)}
          onClick={e => e.stopPropagation()}
          className="cursor-pointer flex-shrink-0"
          aria-label={`Select ${issue.key}`}
        />
      )}
      <span title={type.label} className="flex-shrink-0"><TypeIcon type={issue.type} className="w-4 h-4" /></span>
      <span className="text-xs font-medium text-lira-muted w-20 flex-shrink-0">{issue.key}</span>
      <span className="flex-1 min-w-0 text-sm text-lira-text truncate">{issue.title}</span>
      {issue.blocked && <span className="flex-shrink-0 px-1.5 py-0.5 text-3xs font-bold uppercase rounded" style={{ color: BLOCKED_META.color, backgroundColor: BLOCKED_META.bg }}>Blocked</span>}
      {showSpace && space && (
        <span
          className="text-3xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 text-white"
          style={{ backgroundColor: space.color }}
          title={space.name}
        >
          {space.key}
        </span>
      )}
      {showSprint && <SprintChip sprint={sprint} carried={carried} />}
      {!showSprint && carried && (
        <span title={`Carried over from ${(issue.sprintHistory || []).map(k => sprintLabel(k, true)).join(', ')}`}
          className="text-3xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 flex-shrink-0">
          ↻ carried
        </span>
      )}
      <span title={pri.label} className="flex-shrink-0"><PriorityIcon priority={issue.priority} /></span>
      <span
        className="text-3xs font-semibold px-2 py-0.5 rounded flex-shrink-0 w-[78px] text-center"
        style={{ color: st.color, backgroundColor: st.bg }}
      >
        {st.label}
      </span>
      {typeof issue.storyPoints === 'number' && (
        <span className="text-3xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 flex-shrink-0" title="Story points">
          {issue.storyPoints}
        </span>
      )}
      <Avatar initials={issue.assigneeInitials} size="xs" />
      <SprintSelect
        value={sprint}
        options={Array.from(new Set([...sprintOptions, sprint])).sort()}
        onChange={v => moveIssuesToSprint([issue], v)}
        title="Move to sprint"
        className="w-[110px] flex-shrink-0"
      />
    </div>
  );
};

/** Slim bar above Board / List / Calendar: view all tickets of the space, or just one monthly sprint. */
export const SprintFilterBar: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onManage?: () => void;
}> = ({ value, options, onChange, onManage }) => {
  const cur = currentSprintKey();
  const chip = (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
      active ? 'bg-lira-blue text-white border-lira-blue' : 'bg-white text-lira-muted border-lira-border hover:text-lira-text'
    }`;
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-lira-border bg-white">
      <span className="text-xs text-lira-muted">Sprint:</span>
      <button className={chip(value === 'all')} onClick={() => onChange('all')}>All</button>
      <button className={chip(value === cur)} onClick={() => onChange(cur)}>Current ({sprintLabel(cur, true)})</button>
      <button className={chip(value === nextSprint(cur))} onClick={() => onChange(nextSprint(cur))}>Next</button>
      <SprintSelect
        value={options.includes(value) ? value : 'all'}
        options={options}
        onChange={onChange}
        allLabel="Pick sprint…"
        className="!rounded-full"
      />
      {onManage && (
        <button onClick={onManage} className="ml-auto text-xs text-lira-blue hover:underline cursor-pointer">
          Plan sprints →
        </button>
      )}
    </div>
  );
};
