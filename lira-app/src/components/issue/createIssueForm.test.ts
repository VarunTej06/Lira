import { beforeEach, describe, expect, it } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { addCustomSprint, currentSprintKey, setSprintSpaces, shiftSprint } from '../../utils/sprintUtils';
import { effectiveSprint, missingForTicket, parentCandidates, parentPlaceholder, sprintChoices, sprintsOpenTo, appendLabel } from './createIssueForm';

beforeEach(() => localStorage.clear());

const t = (id: number, type: Issue['type']) => ({ id, key: `K-${id}`, type } as Issue);
const issues = [t(1, 'epic'), t(2, 'task'), t(3, 'bug'), t(4, 'subtask')];

describe('parentCandidates', () => {
  it('an epic has no parent', () => expect(parentCandidates('epic', issues)).toEqual([]));
  it('a task or bug can sit under an epic', () => {
    expect(parentCandidates('task', issues).map(i => i.id)).toEqual([1]);
    expect(parentCandidates('bug', issues).map(i => i.id)).toEqual([1]);
  });
  it('a subtask sits under a task or a bug, never under another subtask or an epic', () => {
    expect(parentCandidates('subtask', issues).map(i => i.id)).toEqual([2, 3]);
  });
});

describe('parentPlaceholder', () => {
  const space = { name: 'Lira' } as Space;
  it('asks for a space first', () => expect(parentPlaceholder('task', undefined, 3)).toBe('Select a space first…'));
  it('says when there is nothing to pick, by kind', () => {
    expect(parentPlaceholder('task', space, 0)).toBe('No epics in Lira yet');
    expect(parentPlaceholder('subtask', space, 0)).toBe('No tasks in Lira yet');
  });
  it('invites a choice otherwise', () => {
    expect(parentPlaceholder('task', space, 2)).toBe('No epic (standalone)');
    expect(parentPlaceholder('subtask', space, 2)).toBe('Select the parent task…');
  });
});

describe('sprints', () => {
  it('offers two sprints back and three forward, sorted, without repeats', () => {
    const cur = currentSprintKey();
    const list = sprintChoices();
    expect(list).toEqual([...list].sort());
    expect(new Set(list).size).toBe(list.length);
    expect(list).toContain(shiftSprint(cur, -2));
    expect(list).toContain(shiftSprint(cur, 3));
    expect(list).not.toContain(shiftSprint(cur, 4));
  });

  it('adds the sprint the dialog was opened for, and custom sprints', () => {
    const far = shiftSprint(currentSprintKey(), 8);
    expect(sprintChoices(far)).toContain(far);
    const custom = addCustomSprint({ start: '2031-01-05', kind: 'weekly', days: 7, name: '' })!;
    expect(sprintChoices()).toContain(custom);
  });

  it('keeps only the sprints that take tickets from the space', () => {
    const cur = currentSprintKey();
    const next = shiftSprint(cur, 1);
    setSprintSpaces(next, [2]);
    const choices = [cur, next];
    expect(sprintsOpenTo(choices, 1)).toEqual([cur]);
    expect(sprintsOpenTo(choices, 2)).toEqual([cur, next]);
    expect(sprintsOpenTo(choices, undefined)).toEqual(choices);
  });

  it('uses the chosen sprint if it is open, else the current one, else the first open one', () => {
    const cur = currentSprintKey();
    const a = shiftSprint(cur, 1);
    const b = shiftSprint(cur, 2);
    expect(effectiveSprint(a, [cur, a, b])).toBe(a);
    expect(effectiveSprint(b, [cur, a])).toBe(cur);
    expect(effectiveSprint(b, [a])).toBe(a);
    expect(effectiveSprint(b, [])).toBe(b);
  });
});

describe('missingForTicket', () => {
  const ok = { title: 'x', hasSpace: true, type: 'task' as const, parentId: undefined };
  it('is empty when nothing is missing', () => expect(missingForTicket(ok)).toBe(''));
  it('asks for a title first', () => expect(missingForTicket({ ...ok, title: '  ', hasSpace: false })).toBe('Title is required'));
  it('then for a space', () => expect(missingForTicket({ ...ok, hasSpace: false })).toBe('Please choose a space for this ticket'));
  it('then, for a subtask, for its parent', () => {
    expect(missingForTicket({ ...ok, type: 'subtask' })).toBe('Choose the task this subtask belongs to');
    expect(missingForTicket({ ...ok, type: 'subtask', parentId: 5 })).toBe('');
  });
  it('does not ask a task for a parent', () => expect(missingForTicket({ ...ok, type: 'bug' })).toBe(''));
});

describe('appendLabel', () => {
  it('starts the list with the first label', () => {
    expect(appendLabel('', 'bug')).toBe('bug');
    expect(appendLabel('   ', 'bug')).toBe('bug');
  });
  it('adds after the existing ones, tidying a trailing comma or space', () => {
    expect(appendLabel('a', 'b')).toBe('a, b');
    expect(appendLabel('a, ', 'b')).toBe('a, b');
    expect(appendLabel('a,, ', 'b')).toBe('a, b');
  });
});
