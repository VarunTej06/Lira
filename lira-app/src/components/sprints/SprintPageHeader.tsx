import { CalendarClock, Plus } from 'lucide-react';
import type { Space } from '../../types/space';
import { sprintName } from '../../utils/sprintUtils';
import { StandupButton } from '../standup/StandupButton';

interface Props {
  spaces: Space[];
  scope: 'all' | number;
  onScopeChange: (scope: 'all' | number) => void;
  /** When set, the page belongs to one space and the space picker is hidden. */
  lockedSpaceId?: number;
  sprint: string;
  onBack?: () => void;
  onCreateSprint?: () => void;
  onOpenAllTickets?: () => void;
}

/** Page title, the space picker, and the buttons at the top right. */
export function SprintPageHeader({ spaces, scope, onScopeChange, lockedSpaceId, sprint, onBack, onCreateSprint, onOpenAllTickets }: Props) {
  const spaceName = (id: number) => spaces.find(s => s.id === id)?.name;
  return (
    <div className="flex flex-wrap items-center gap-3 justify-between">
      <div>
        {onBack && <button onClick={onBack} className="text-xs text-lira-blue hover:underline cursor-pointer mb-1">← All sprints</button>}
        <h1 className="text-xl font-semibold text-lira-text flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-lira-blue" />
          {lockedSpaceId ? `${spaceName(lockedSpaceId) ?? 'Space'} sprints` : 'Sprints'}
        </h1>
        <p className="text-xs text-lira-muted mt-0.5">Sprints run monthly, weekly, bi-weekly or for a set number of days.</p>
      </div>
      <div className="flex items-center gap-2">
        {!lockedSpaceId && (
          <select
            value={scope}
            onChange={e => onScopeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-sm border border-lira-border rounded-md px-3 py-1.5 bg-white text-lira-text cursor-pointer"
            aria-label="Space"
          >
            <option value="all">All spaces</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <StandupButton
          scope={{
            type: 'sprint',
            id: `sprint:${sprint}:${scope}`,
            name: `${sprintName(sprint)}${scope !== 'all' ? ' · ' + (spaceName(scope) ?? '') : ''}`,
            sprint,
            spaceId: scope === 'all' ? undefined : scope,
          }}
          className="!py-1.5 !text-sm"
        />
        {onCreateSprint && (
          <button onClick={onCreateSprint} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-lira-blue text-lira-on-blue hover:bg-lira-blue-hover cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New sprint
          </button>
        )}
        {onOpenAllTickets && (
          <button onClick={onOpenAllTickets} className="text-sm px-3 py-1.5 border border-lira-border rounded-md bg-white text-lira-text hover:bg-gray-50 cursor-pointer">
            All tickets
          </button>
        )}
      </div>
    </div>
  );
}
