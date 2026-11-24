import { describe, expect, it } from 'vitest';
import { makeIssue } from '../test/factories';
import { countOf, orderForCreation, parseImportFiles, remapObject } from './importWorkspace';

const space = (id: number, key: string, over: object = {}) => ({ id, key, name: `Space ${key}`, icon: 'x', color: '#336699', ...over });
const issue = (id: number, spaceId: number, over: object = {}) => ({ id, spaceId, key: `K-${id}`, title: `T${id}`, type: 'task', status: 'todo', priority: 'medium', ...over });
const file = (name: string, json: unknown) => ({ name, text: JSON.stringify(json) });

describe('reading the files of a local workspace', () => {
  it('reads the one workspace file: its spaces with their own tickets', () => {
    const { bundle, problems, ignored } = parseImportFiles([file('lira-workspace.json', { spaces: [space(1, 'AAA'), space(2, 'BBB')], issues: [issue(10, 1), issue(11, 1), issue(20, 2)] })]);
    expect(bundle.spaces.map(s => [s.space.key, s.issues.length])).toEqual([['AAA', 2], ['BBB', 1]]);
    expect(problems).toEqual([]); expect(ignored).toEqual([]);
  });

  it('reads the split form too, by what is in each file and not by its name, and a space that comes twice is taken once', () => {
    const p = parseImportFiles([
      file('AI.json', { space: space(1, 'AI'), issues: [issue(10, 1)] }), file('whatever.json', { space: space(1, 'AI'), issues: [issue(10, 1), issue(11, 1)] }),
      file('projects.json', { entries: { lira_projects: [{ id: 'p1', name: 'One', spaceId: 1 }] } }), file('dashboards.json', { entries: { lira_dashboards: [{ id: 'd1', name: 'Dash' }] } }),
      file('rm-1.json', { roadmap: { id: 'r1', name: 'Plan', spaceKey: 'AI' } }),
    ]);
    expect(countOf(p.bundle)).toEqual({ spaces: 1, tickets: 1, projects: 1, roadmaps: 1, dashboards: 1 });
  });

  it('lists what it does not understand and leaves out what the server would refuse, instead of guessing', () => {
    const p = parseImportFiles([
      file('lira-workspace.json', { spaces: [space(1, 'AAA'), space(2, 'bad key'), { id: 3, key: 'CCC' }], issues: [issue(10, 1), { id: 11, spaceId: 1 }, issue(12, 1, { title: '' })] }),
      { name: 'broken.json', text: '{ not json' }, file('settings.json', { theme: 'dark' }), file('list.json', [1, 2]),
      file('projects.json', { entries: { lira_projects: [{ name: 'no id' }, { id: 'has space', name: 'x' }, { id: 'ok', name: 'y' }] } }),
    ]);
    expect(p.bundle.spaces.map(s => s.space.key)).toEqual(['AAA']);
    expect(p.bundle.spaces[0].issues).toHaveLength(1);
    expect(p.problems.join(' ')).toContain('"bad key"');
    expect(p.problems.join(' ')).toContain('2 ticket(s) of AAA');
    expect(p.ignored).toEqual(expect.arrayContaining(['broken.json (not JSON)', 'settings.json', 'list.json (not a Lira file)']));
    expect(p.bundle.projects.map(x => x.id)).toEqual(['ok']);
  });

  it('gives a space a plain icon and colour when its own are missing or not valid, and keeps its description', () => {
    const { bundle } = parseImportFiles([file('s.json', { space: { id: 1, key: 'AB', name: 'Ab', icon: '', color: 'red', description: 'About' }, issues: [] })]);
    expect(bundle.spaces[0].space).toMatchObject({ icon: 'folder', color: '#336699', description: 'About' });
  });
});

describe('the order tickets are made in', () => {
  it('makes a ticket\'s parent and epic first, whatever order they are in the file', () => {
    const a = makeIssue({ id: 3, parentId: 2 }); const b = makeIssue({ id: 2, epicId: 1 }); const c = makeIssue({ id: 1 });
    expect(orderForCreation([a, b, c]).map(i => i.id)).toEqual([1, 2, 3]);
  });

  it('keeps every ticket once, and does not loop on a ticket that points at itself, a cycle, or something that is not there', () => {
    const issues = [makeIssue({ id: 1, parentId: 1 }), makeIssue({ id: 2, parentId: 3 }), makeIssue({ id: 3, parentId: 2 }), makeIssue({ id: 4, epicId: 99 })];
    expect(orderForCreation(issues).map(i => i.id).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('moving a project, roadmap or dashboard to the new space numbers', () => {
  const ids = new Map([[1, 11], [2, 12]]); const keys = new Map([['AAA', 'AAA2']]);
  it('moves a project by space number, a roadmap by space key, and a dashboard\'s filters and widgets', () => {
    expect(remapObject('project', { id: 'p', spaceId: 1 }, ids, keys).spaceId).toBe(11);
    expect(remapObject('roadmap', { id: 'r', spaceKey: 'AAA' }, ids, keys).spaceKey).toBe('AAA2');
    const d = remapObject('dashboard', { id: 'd', filters: { spaceIds: [1, 2], range: 'all' }, widgets: [{ id: 'w', filters: { spaceIds: [2] } }, { id: 'v' }] }, ids, keys);
    expect(d.filters).toEqual({ spaceIds: [11, 12], range: 'all' });
    expect(d.widgets).toEqual([{ id: 'w', filters: { spaceIds: [12] } }, { id: 'v' }]);
  });

  it('leaves what it does not know alone, and never changes the original', () => {
    const doc = { id: 'p', spaceId: 99, name: 'x' };
    expect(remapObject('project', doc, ids, keys)).toEqual(doc);
    expect(remapObject('roadmap', { id: 'r', spaceKey: 'ZZZ' }, ids, keys).spaceKey).toBe('ZZZ');
    expect(remapObject('dashboard', { id: 'd' }, ids, keys)).toEqual({ id: 'd' });
    const before = { id: 'p', spaceId: 1 };
    remapObject('project', before, ids, keys);
    expect(before.spaceId).toBe(1);
  });
});
