import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { burnup, buildReport, cumulativeFlow, joinedSprintAt, leadAndCycle, reportHtml, reportMarkdown, scopeChanges, statusAt } from './sprintReports';
import { setSprintMeta, sprintName } from './sprintUtils';
import type { Issue } from '../types/issue';

const D = (day: number, h = 12) => new Date(2026, 10, day, h); // November 2026

let nextId = 1;
const make = (over: Partial<Issue>): Issue => ({
  id: nextId++, spaceId: 1, key: `T-${nextId}`, title: 'ticket', description: '', type: 'task', status: 'todo', priority: 'medium',
  reporter: 'x', reporterInitials: 'X', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [],
  rank: 1, createdAt: D(1), updatedAt: D(1), watchers: [], sprint: '2026-11', ...over,
}) as Issue;

beforeEach(() => { localStorage.clear(); nextId = 1; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(D(12)); });
afterEach(() => vi.useRealTimers());

describe('statusAt', () => {
  it('follows the status log, and is null before the ticket existed', () => {
    const i = make({ createdAt: D(2), status: 'done', statusLog: [{ from: 'todo', to: 'inprogress', at: D(4) }, { from: 'inprogress', to: 'done', at: D(8) }] });
    expect(statusAt(i, D(1))).toBeNull();
    expect(statusAt(i, D(3))).toBe('todo');
    expect(statusAt(i, D(5))).toBe('inprogress');
    expect(statusAt(i, D(9))).toBe('done');
  });
  it('falls back to resolvedAt for older tickets without a log', () => {
    const i = make({ status: 'done', resolvedAt: D(6) });
    expect(statusAt(i, D(5))).toBe('inprogress');
    expect(statusAt(i, D(7))).toBe('done');
  });
});

describe('cumulative flow and burnup', () => {
  const list = [
    make({ status: 'done', resolvedAt: D(5), statusLog: [{ from: 'todo', to: 'done', at: D(5) }], storyPoints: 3 }),
    make({ status: 'todo', storyPoints: 2 }),
    make({ status: 'todo', createdAt: D(8), storyPoints: 5 }), // created on day 8 -> scope grows
  ];
  it('counts tickets per status per day up to today (12 Nov)', () => {
    const flow = cumulativeFlow(list, '2026-11');
    expect(flow).toHaveLength(12);
    expect(flow[0]).toMatchObject({ todo: 2, done: 0 });
    expect(flow[4]).toMatchObject({ todo: 1, done: 1 });
    expect(flow[11]).toMatchObject({ todo: 2, done: 1 });
  });
  it('shows scope growing when a ticket is added mid-sprint', () => {
    const b = burnup(list, '2026-11');
    expect(b[0]).toMatchObject({ scope: 2, done: 0, scopePoints: 5 });
    expect(b[7]).toMatchObject({ scope: 3, done: 1, scopePoints: 10, donePoints: 3 });
  });
});

describe('scope changes', () => {
  const name = sprintName('2026-11');
  const added = make({ createdAt: D(2), activity: [{ id: 'a', type: 'field_change', author: 'v', authorInitials: 'V', description: '', oldValue: sprintName('2026-10'), newValue: name, createdAt: D(9) }] });
  const planned = make({ createdAt: D(1) });
  const created = make({ createdAt: D(7) });
  const removed = make({ sprint: '2026-12', activity: [{ id: 'b', type: 'field_change', author: 'v', authorInitials: 'V', description: '', oldValue: name, newValue: sprintName('2026-12'), createdAt: D(10) }] });
  it('flags tickets added after the first day, and tickets taken out', () => {
    const c = scopeChanges([added, planned, created, removed], '2026-11');
    expect(c.map(x => [x.kind, x.issue.id])).toEqual([['added', created.id], ['added', added.id], ['removed', removed.id]]);
  });
  it('tells a rollover at close apart from a removal', () => {
    const c = scopeChanges([removed], '2026-11', D(10).toISOString());
    expect(c[0].kind).toBe('carried');
  });
  it('a ticket created before the sprint counts as planned, not as a change', () => {
    expect(joinedSprintAt(planned, '2026-11')).toEqual(D(1));
    expect(scopeChanges([planned], '2026-11')).toEqual([]);
  });
});

describe('lead and cycle time', () => {
  it('averages created→done and started→done over finished tickets only', () => {
    const a = make({ status: 'done', createdAt: D(1, 0), resolvedAt: D(5, 0), statusLog: [{ from: 'todo', to: 'inprogress', at: D(3, 0) }, { from: 'inprogress', to: 'done', at: D(5, 0) }] });
    const b = make({ status: 'done', createdAt: D(1, 0), resolvedAt: D(3, 0) }); // no start recorded
    const open = make({ status: 'inprogress' });
    const t = leadAndCycle([a, b, open]);
    expect(t.lead).toMatchObject({ n: 2, avg: 3, median: 3, max: 4 });
    expect(t.cycle).toMatchObject({ n: 1, avg: 2 });
  });
  it('is all zeros when nothing is finished', () => {
    expect(leadAndCycle([make({})]).lead).toEqual({ n: 0, avg: 0, median: 0, max: 0 });
  });
});

describe('report export', () => {
  it('writes Markdown with the goal, numbers, scope changes and retro', () => {
    setSprintMeta('all', '2026-11', { goal: 'Ship phase 4', retro: { wentWell: ['Pairing'], didnt: ['Late scope'], actions: [{ text: 'Freeze scope on day 2', done: false }] } });
    const list = [make({ status: 'done', resolvedAt: D(5), storyPoints: 3 }), make({ createdAt: D(8), title: 'Late one' })];
    const md = reportMarkdown(buildReport(list, list, '2026-11', 'all'));
    expect(md).toContain('# November 2026 Sprint');
    expect(md).toContain('**Goal:** Ship phase 4');
    expect(md).toContain('1 of 2 done (50%)');
    expect(md).toContain('Added · ');
    expect(md).toContain('Late one');
    expect(md).toContain('- Pairing');
    expect(md).toContain('- [ ] Freeze scope on day 2');
  });
  it('escapes ticket titles in the printable page', () => {
    const list = [make({ title: '<script>alert(1)</script>', createdAt: D(8) })];
    const html = reportHtml(buildReport(list, list, '2026-11', 'all'));
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('resolvedAt and status log on the database', () => {
  const base = { spaceId: 1, title: 'x', description: '', type: 'task', priority: 'medium', reporter: 'x', reporterInitials: 'X', labels: [], subtasks: [], comments: [], activity: [], attachments: [], linkedIssues: [], rank: 1, createdAt: new Date(), updatedAt: new Date(), watchers: [] };
  beforeEach(async () => { await db.issues.clear(); });

  it('stamps resolvedAt when a ticket reaches Done, and clears it when reopened', async () => {
    const id = await db.issues.add({ ...base, key: 'A-1', status: 'todo' } as unknown as Issue);
    await db.issues.update(id, { status: 'inprogress' });
    expect((await db.issues.get(id))?.resolvedAt).toBeUndefined();
    await db.issues.update(id, { status: 'done' });
    const done = await db.issues.get(id);
    expect(done?.resolvedAt).toBeInstanceOf(Date);
    expect(done?.statusLog?.map(e => `${e.from}>${e.to}`)).toEqual(['todo>inprogress', 'inprogress>done']);
    await db.issues.update(id, { status: 'todo' });
    expect((await db.issues.get(id))?.resolvedAt).toBeUndefined();
  });

  it('does not log or restamp when the status did not change', async () => {
    const id = await db.issues.add({ ...base, key: 'A-2', status: 'done' } as unknown as Issue);
    const first = (await db.issues.get(id))?.resolvedAt;
    expect(first).toBeInstanceOf(Date); // created as Done
    await db.issues.update(id, { status: 'done', title: 'renamed' });
    const after = await db.issues.get(id);
    expect(after?.resolvedAt).toEqual(first);
    expect(after?.statusLog).toBeUndefined();
  });

  it('keeps an explicitly supplied resolvedAt', async () => {
    const id = await db.issues.add({ ...base, key: 'A-3', status: 'todo' } as unknown as Issue);
    const when = new Date(2020, 0, 1);
    await db.issues.update(id, { status: 'done', resolvedAt: when });
    expect((await db.issues.get(id))?.resolvedAt).toEqual(when);
  });
});

describe('suggested capacity', () => {
  it('is the average points done in the last closed sprints, or null with no history', async () => {
    const { suggestedCapacity } = await import('./sprintReports');
    const done = (sprint: string, pts: number) => make({ sprint, status: 'done', storyPoints: pts, resolvedAt: D(2) });
    expect(suggestedCapacity([], ['2026-09', '2026-10', '2026-11'])).toBeNull();
    expect(suggestedCapacity([done('2026-09', 10), done('2026-10', 20), done('2026-11', 99)], ['2026-09', '2026-10', '2026-11'])).toBe(15); // November is not closed yet
  });
});
