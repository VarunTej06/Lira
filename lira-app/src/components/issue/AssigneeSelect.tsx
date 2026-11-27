import { useAssignees } from '../../hooks/useAssignees';
import { initialsOf } from '../../utils/hostedProfile';
import { Avatar } from '../common/Avatar';

export interface AssigneePatch { assignee: string | undefined; assigneeInitials: string | undefined }
interface Props {
  /** The space of the ticket: who it may be given to depends on it. */
  spaceId: number | undefined;
  assignee: string | undefined;
  initials: string | undefined;
  onChange: (patch: AssigneePatch) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Picks who a ticket is given to, from the people of its space, with their picture beside it. Whoever it is given to already stays in the list even if they are no longer a member. */
export function AssigneeSelect({ spaceId, assignee, initials, onChange, label, disabled = false, className = '' }: Props) {
  const options = useAssignees(spaceId);
  const current = assignee === 'VY' ? 'Varuntej Yadla' : (assignee ?? ''); // tickets of the first version name this person by their letters
  const change = (value: string) => {
    const match = options.find(o => o.value === value);
    onChange({ assignee: value || undefined, assigneeInitials: value ? (match?.initials || initialsOf(value)) : undefined });
  };
  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      {initials ? <Avatar initials={initials} size="xs" /> : <span className="w-5 h-5 rounded-full border-2 border-dashed border-lira-border flex-shrink-0" aria-hidden="true" />}
      <select aria-label={label} value={current} disabled={disabled} onChange={e => change(e.target.value)} onClick={e => e.stopPropagation()}
        className={`min-w-0 flex-1 text-sm border border-lira-border rounded-xl px-2 py-1 bg-white text-lira-text focus:outline-none focus:border-lira-blue disabled:opacity-60 ${className}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.value === '' ? 'Unassigned' : o.label}</option>)}
        {current && !options.some(o => o.value === current) && <option value={current}>{current} ({initials || initialsOf(current)})</option>}
      </select>
    </div>
  );
}
