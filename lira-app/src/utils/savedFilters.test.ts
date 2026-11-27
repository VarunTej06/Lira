import { describe, expect, it } from 'vitest';
import { makeSpace } from '../test/factories';
import { addSaved, describeSpec, hasAnyFilter, MAX_NAME, MAX_SAVED, readSpec, removeSaved, renameSaved, sameSpec, type FilterSpec, type SavedFilter } from './savedFilters';

const empty = (): FilterSpec => ({ query: '', spaces: [], statuses: [], priorities: [], types: [], assignees: [], labels: [], team: 'all', recentOnly: false, sort: 'updatedAt', ascending: false });
const open = (): FilterSpec => ({ ...empty(), statuses: ['todo', 'inprogress'] });
const saved = (id: string, name: string, spec = open()): SavedFilter => ({ id, name, spec, createdAt: 'now' });

describe('reading a stored filter', () => {
  it('accepts a whole filter, and gives back the same thing', () => {
    expect(readSpec(open())).toEqual(open());
    expect(readSpec(JSON.parse(JSON.stringify(open())))).toEqual(open());
  });
  it('refuses anything missing, of the wrong kind, too long, or with a sort that is not one of ours, instead of applying part of it', () => {
    const bad: unknown[] = [null, 'x', 5, [], {}, { ...open(), spaces: ['1'] }, { ...open(), statuses: 'todo' }, { ...open(), query: 5 }, { ...open(), query: 'x'.repeat(501) },
      { ...open(), team: 3 }, { ...open(), recentOnly: 'yes' }, { ...open(), sort: 'secret' }, { ...open(), ascending: 1 }, { ...open(), labels: Array(201).fill('a') }, { ...open(), assignees: [{}] }];
    for (const raw of bad) expect(readSpec(raw), JSON.stringify(raw)?.slice(0, 40)).toBeNull();
  });
  it('drops fields it does not know, so a stored filter cannot carry anything extra into the page', () => {
    expect(readSpec({ ...open(), evil: '<img onerror=x>' })).toEqual(open());
  });
});

describe('what counts as a filter', () => {
  it('is nothing for the empty filter or a blank search, and something for each kind of choice', () => {
    expect(hasAnyFilter(empty())).toBe(false);
    expect(hasAnyFilter({ ...empty(), query: '   ' })).toBe(false);
    for (const change of [{ query: 'x' }, { spaces: [1] }, { statuses: ['done'] }, { priorities: ['high'] }, { types: ['bug'] }, { assignees: ['A'] }, { labels: ['ui'] }, { team: 'QA' }, { recentOnly: true }]) {
      expect(hasAnyFilter({ ...empty(), ...change }), JSON.stringify(change)).toBe(true);
    }
    expect(hasAnyFilter({ ...empty(), sort: 'title', ascending: true })).toBe(false); // sorting alone is not a filter
  });
  it('is the same filter whatever order the choices were made in, and not when something differs', () => {
    expect(sameSpec({ ...empty(), statuses: ['a', 'b'] }, { ...empty(), statuses: ['b', 'a'] })).toBe(true);
    expect(sameSpec({ ...empty(), query: ' x ' }, { ...empty(), query: 'x' })).toBe(true);
    expect(sameSpec(open(), { ...open(), sort: 'title' })).toBe(false);
    expect(sameSpec(open(), empty())).toBe(false);
  });
  it('says in a line what a filter does, with space names, and "Everything" for none', () => {
    const spaces = [makeSpace({ id: 1, name: 'Alpha' })];
    expect(describeSpec({ ...empty(), query: 'login', spaces: [1, 9], statuses: ['todo'], team: 'QA', recentOnly: true }, spaces)).toBe('“login” · Alpha · Space 9 · todo · Team QA · Recently updated');
    expect(describeSpec(empty(), spaces)).toBe('Everything');
  });
});

describe('keeping saved filters', () => {
  it('saves under a trimmed name with a time, and keeps the others', () => {
    const r = addSaved([saved('a', 'Mine')], '  Open work  ', open(), 'b', 'now');
    expect(r.error).toBeUndefined();
    expect(r.list.map(f => f.name)).toEqual(['Mine', 'Open work']);
    expect(r.list[1]).toMatchObject({ id: 'b', spec: open(), createdAt: 'now' });
  });
  it('refuses an empty filter, a blank name, a long name, a name already used in any case, and too many', () => {
    const list = [saved('a', 'Open work')];
    expect(addSaved(list, 'x', empty(), 'n', 'now').error).toBe('Choose some filters first.');
    expect(addSaved(list, '   ', open(), 'n', 'now').error).toBe('Give it a name.');
    expect(addSaved(list, 'x'.repeat(MAX_NAME + 1), open(), 'n', 'now').error).toContain(`${MAX_NAME}`);
    expect(addSaved(list, 'OPEN WORK', open(), 'n', 'now').error).toContain('exists');
    const full = Array.from({ length: MAX_SAVED }, (_, i) => saved(`i${i}`, `F${i}`));
    expect(addSaved(full, 'One more', open(), 'n', 'now').error).toContain('Delete one first');
    for (const r of [addSaved(list, '   ', open(), 'n', 'now'), addSaved(full, 'One more', open(), 'n', 'now')]) expect(r.list.length).toBeGreaterThan(0);
  });
  it('removes one and keeps the rest', () => {
    expect(removeSaved([saved('a', 'A'), saved('b', 'B')], 'a').map(f => f.id)).toEqual(['b']);
    expect(removeSaved([saved('a', 'A')], 'missing')).toHaveLength(1);
  });
  it('renames one under the same rules, and may keep its own name', () => {
    const list = [saved('a', 'A'), saved('b', 'B')];
    expect(renameSaved(list, 'a', ' New ').list.map(f => f.name)).toEqual(['New', 'B']);
    expect(renameSaved(list, 'a', 'a').error).toBeUndefined();
    expect(renameSaved(list, 'a', 'b').error).toContain('exists');
    expect(renameSaved(list, 'a', '').error).toBe('Give it a name.');
    expect(renameSaved(list, 'a', 'x'.repeat(61)).error).toContain('60');
  });
});
