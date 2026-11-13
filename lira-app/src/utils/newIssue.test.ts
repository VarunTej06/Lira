import { describe, expect, it } from 'vitest';
import { NEW_TICKET_STATUSES, buildNewIssue, newTicketStatus, type NewIssueInput } from './newIssue';
import { makeIssue } from '../test/factories';

const base: NewIssueInput = {
  spaceId: 1, key: 'T-5', title: '  Fix login  ', description: ' text ', type: 'task', status: 'todo', priority: 'high',
  dueDate: '', labels: 'ui, api,, ', sprint: '2026-11', attachments: [], spaceIssues: [], now: new Date(2026, 10, 9, 10),
};

describe('New ticket from the Create form', () => {
  it('trims text, splits labels and records who created it', () => {
    const t = buildNewIssue(base);
    expect([t.title, t.description, t.labels]).toEqual(['Fix login', 'text', ['ui', 'api']]);
    expect([t.assignee, t.reporter, t.watchers]).toEqual(['VY', 'VY', ['VY']]);
    expect(t.activity).toHaveLength(1);
    expect(t.activity[0].description).toBe('created this issue');
  });

  it('puts a task in the sprint but not an epic', () => {
    expect(buildNewIssue(base).sprint).toBe('2026-11');
    expect(buildNewIssue({ ...base, type: 'epic' }).sprint).toBeUndefined();
  });

  it('links to the parent and takes its epic: a parent epic is the epic, a parent task passes its own on', () => {
    const epic = makeIssue({ id: 10, type: 'epic', title: 'Big' });
    const task = makeIssue({ id: 11, type: 'task', title: 'Mid', epicId: 10 });
    const underEpic = buildNewIssue({ ...base, parentId: 10, spaceIssues: [epic, task] });
    expect([underEpic.parentId, underEpic.epicId, underEpic.epicLink]).toEqual([10, 10, 'Big']);
    const underTask = buildNewIssue({ ...base, type: 'subtask', parentId: 11, spaceIssues: [epic, task] });
    expect([underTask.parentId, underTask.epicId, underTask.epicLink]).toEqual([11, 10, 'Mid']);
  });

  it('reads the due date, or leaves it empty', () => {
    expect(buildNewIssue(base).dueDate).toBeUndefined();
    expect(buildNewIssue({ ...base, dueDate: '2026-12-01' }).dueDate).toEqual(new Date('2026-12-01'));
  });
});

describe('Where a new ticket starts', () => {
  it('offers Backlog and To Do only', () => {
    expect(NEW_TICKET_STATUSES.map(s => s[0])).toEqual(['backlog', 'todo']);
  });
  it('is Backlog when asked for, and To Do for anything else', () => {
    expect(newTicketStatus('backlog')).toBe('backlog');
    for (const wanted of ['todo', 'inprogress', 'done', 'review', '', undefined]) expect(newTicketStatus(wanted)).toBe('todo');
  });
  it('holds for every ticket that is built, whatever status the caller passes', () => {
    expect(buildNewIssue({ ...base, status: 'done' }).status).toBe('todo');
    expect(buildNewIssue({ ...base, status: 'inprogress' }).status).toBe('todo');
    expect(buildNewIssue({ ...base, status: 'backlog' }).status).toBe('backlog');
  });
});
