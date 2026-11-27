import { useEffect, useState } from 'react';
import { ASSIGNEE_OPTIONS } from '../components/issue/detail/issueOptions';
import { listAssignable } from '../services/workspaceApi';
import { currentTimeMs } from '../utils/clock';
import { isHosted } from '../utils/edition';
import { initialsOf } from '../utils/hostedProfile';
import { activeOrg } from '../utils/hostedOrg';
import { loadProfile } from '../utils/userPrefs';

export interface AssigneeOption { value: string; label: string; initials: string }

const NONE: AssigneeOption = { value: '', label: 'Unassigned', initials: '' };
const KEEP_MS = 60_000;
const known = new Map<string, { at: number; people: Promise<AssigneeOption[]> }>();

const fromName = (name: string): AssigneeOption => ({ value: name, label: `${name} (${initialsOf(name)})`, initials: initialsOf(name) });

/** The people a ticket of the space may be given to. Asked of the server once a minute at most, however many tickets on the screen ask. */
function peopleOf(org: string, spaceId: number): Promise<AssigneeOption[]> {
  const key = `${org}/${spaceId}`;
  const hit = known.get(key);
  if (hit && currentTimeMs() - hit.at < KEEP_MS) return hit.people;
  const people = listAssignable(org, spaceId).then(r => (r.ok ? r.data.map(p => fromName(p.name)) : []));
  known.set(key, { at: currentTimeMs(), people });
  return people;
}

/** Forgets the lists, for a sign-out or a change of workspace, and for tests. */
export const forgetAssignees = (): void => known.clear();

/**
 * The people a ticket of this space can be assigned to, "Unassigned" first. Hosted edition: the Owner, Admins and everyone who was given the
 * space (never people who may only look), from the server. Local edition: the sample team of the workspace and the person using it.
 */
export function useAssignees(spaceId: number | undefined): AssigneeOption[] {
  const org = activeOrg();
  const hosted = isHosted() && org !== null;
  const [people, setPeople] = useState<AssigneeOption[]>([]);
  useEffect(() => {
    if (!hosted || !org || spaceId === undefined) return;
    let current = true;
    void peopleOf(org, spaceId).then(list => { if (current) setPeople(list); });
    return () => { current = false; };
  }, [hosted, org, spaceId]);
  if (hosted) return [NONE, ...people];
  const me = loadProfile().name;
  const base = ASSIGNEE_OPTIONS.filter(o => o.value !== '');
  return [NONE, ...(me && !base.some(o => o.value === me) ? [fromName(me)] : []), ...base];
}
