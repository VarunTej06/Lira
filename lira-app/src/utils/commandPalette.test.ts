import { describe, expect, it, vi } from 'vitest';
import { makeIssue, makeSpace } from '../test/factories';
import { actionCommands, pageCommands, rank, scoreOf, spaceCommands, ticketCommands, type Command } from './commandPalette';

const cmd = (label: string, over: Partial<Command> = {}): Command => ({ id: label, group: 'Go to', label, run: () => undefined, ...over });

describe('scoring a command for a search', () => {
  it('scores a label that starts with the word above a word inside it, above a text that merely contains it', () => {
    const start = scoreOf(cmd('Roadmaps'), 'road'); const word = scoreOf(cmd('All roadmaps'), 'road'); const inside = scoreOf(cmd('Abroad'), 'road');
    expect(start).toBeGreaterThan(word); expect(word).toBeGreaterThan(inside); expect(inside).toBeGreaterThan(0);
  });
  it('needs every word to match, in the label, the detail or the keywords, in any case', () => {
    const c = cmd('Create a ticket', { keywords: 'new add issue' });
    expect(scoreOf(c, 'CREATE ticket')).toBeGreaterThan(0);
    expect(scoreOf(c, 'new issue')).toBeGreaterThan(0);
    expect(scoreOf(c, 'create banana')).toBe(0);
    expect(scoreOf(cmd('Lira', { detail: 'LIRA' }), 'lira')).toBeGreaterThan(0);
  });
  it('matches letters in order only for three letters or more, and treats an empty search as matching everything', () => {
    expect(scoreOf(cmd('Dashboards'), 'dbd')).toBeGreaterThan(0);
    expect(scoreOf(cmd('Dashboards'), 'db')).toBe(0);
    expect(scoreOf(cmd('Dashboards'), '   ')).toBe(1);
    expect(scoreOf(cmd('Dashboards'), 'xyz')).toBe(0);
    expect(scoreOf(cmd('Mind maps', { keywords: 'storyboard brainstorm' }), 'sbd')).toBe(0); // letters in order are tried on the label only, never on hidden keywords
    expect(scoreOf(cmd('Story boxes', { keywords: 'estimate points planning poker' }), 'mind')).toBe(0);
    expect(scoreOf(cmd('CRS-1 MLOps Specialization: DeepLearning.AI', { group: 'Tickets' }), 'mind')).toBe(0); // a long ticket title would match by chance
    expect(scoreOf(cmd('CRS-1 MLOps Specialization: DeepLearning.AI', { group: 'Tickets' }), 'deeplearning')).toBeGreaterThan(0);
  });
});

describe('ranking', () => {
  const all = [cmd('Projects'), cmd('Roadmaps'), cmd('Sprints'), cmd('Lira', { group: 'Spaces', detail: 'LIRA' }), cmd('Create a ticket', { group: 'Actions' })];
  it('lists everything in group order when nothing is typed, keeping the order given within a group', () => {
    expect(rank(all, '').map(c => c.label)).toEqual(['Projects', 'Roadmaps', 'Sprints', 'Lira', 'Create a ticket']);
    expect(rank(all, '   ').length).toBe(5);
  });
  it('lists only matches, best first inside each group', () => {
    const out = rank([cmd('All roadmaps'), cmd('Roadmaps'), cmd('Abroad')], 'road');
    expect(out.map(c => c.label)).toEqual(['Roadmaps', 'All roadmaps', 'Abroad']);
    expect(rank(all, 'zzzz')).toEqual([]);
  });
  it('shows at most so many of each group', () => {
    const many = Array.from({ length: 20 }, (_, i) => cmd(`Page ${i}`));
    expect(rank(many, '', 8)).toHaveLength(8);
    expect(rank(many, 'page', 5)).toHaveLength(5);
  });
});

describe('the commands', () => {
  it('has a page for each place, and Calls and Teams only in the hosted edition', () => {
    const labels = (hosted: boolean) => pageCommands(() => undefined, hosted).map(c => c.label);
    expect(labels(false)).toEqual(expect.arrayContaining(['For you', 'Projects', 'Mind maps', 'Story boxes', 'Filters']));
    expect(labels(false)).not.toContain('Calls');
    expect(labels(true)).toEqual(expect.arrayContaining(['Calls', 'Teams and access']));
  });
  it('goes to the page, and to a space\'s board', () => {
    const go = vi.fn();
    pageCommands(go, false).find(c => c.label === 'Sprints')!.run();
    spaceCommands([makeSpace({ id: 3, key: 'ABC', name: 'Alpha' })], go)[0].run();
    expect(go.mock.calls.map(c => c[0])).toEqual(['/sprints', expect.stringContaining('/space/ABC/')]);
  });
  it('lists tickets only when something is typed, finds them by key or title, and opens the one chosen', () => {
    const open = vi.fn();
    const issues = [makeIssue({ id: 1, key: 'LIRA-12', title: 'Fix the board' }), makeIssue({ id: 2, key: 'LIRA-13', title: 'Write docs' })];
    expect(ticketCommands(issues, '', open)).toEqual([]);
    const found = rank(ticketCommands(issues, 'lira-13', open), 'lira-13');
    expect(found.map(c => c.label)).toEqual(['LIRA-13 Write docs']);
    found[0].run();
    expect(open).toHaveBeenCalledWith(issues[1]);
    expect(rank(ticketCommands(issues, 'docs', open), 'docs').map(c => c.label)).toEqual(['LIRA-13 Write docs']);
  });
  it('runs the two actions it is given', () => {
    const createTicket = vi.fn(); const createSpace = vi.fn();
    const [a, b] = actionCommands({ createTicket, createSpace });
    a.run(); b.run();
    expect(createTicket).toHaveBeenCalledTimes(1); expect(createSpace).toHaveBeenCalledTimes(1);
  });
});
