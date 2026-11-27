import { describe, expect, it } from 'vitest';
import type { Grant, Team } from '../services/accessApi';
import { accessFor, cellFor, initialsOf, objectName, reachSummary, type ObjectChoices } from './accessRows';

const g = (id: string, subjectType: 'user' | 'team', subjectId: string, objectId = '1'): Grant => ({ id, subjectType, subjectId, kind: 'space', objectId, level: 'view' });
const teams: Team[] = [{ id: 't1', name: 'QA', memberIds: ['u1'] }];
const grants = [g('a', 'user', 'u1'), g('b', 'team', 't1', '2'), g('c', 'user', 'u2', '3'), g('d', 'team', 't9', '4')];

describe('what a person or team can reach', () => {
  it('lists what was given to the person, then what their teams were given, with the team named', () => {
    const rows = accessFor({ type: 'user', id: 'u1', teamIds: ['t1'] }, grants, teams);
    expect(rows.map(r => [r.grant.id, r.via])).toEqual([['a', null], ['b', 'QA']]);
  });
  it('never lists what was given to someone else or to a team the person is not in', () => {
    expect(accessFor({ type: 'user', id: 'u1', teamIds: ['t1'] }, grants, teams).map(r => r.grant.id)).not.toContain('c');
    expect(accessFor({ type: 'user', id: 'u1', teamIds: [] }, grants, teams).map(r => r.grant.id)).toEqual(['a']);
  });
  it('lists only a team\'s own grants for a team', () => {
    expect(accessFor({ type: 'team', id: 't1' }, grants, teams).map(r => [r.grant.id, r.via])).toEqual([['b', null]]);
  });
  it('names a team that no longer exists without failing', () => {
    expect(accessFor({ type: 'user', id: 'u1', teamIds: ['t9'] }, grants, teams).find(r => r.grant.id === 'd')?.via).toBe('a removed team');
  });
});

describe('the name of a shared thing', () => {
  const choices = { space: [{ id: '1', name: 'Lira (LIRA)' }], project: [], roadmap: [], dashboard: [], storybox: [], mindmap: [] } as ObjectChoices;
  it('is looked up by kind and id, with a plain word for one that was deleted', () => {
    expect(objectName(choices, 'space', '1')).toBe('Lira (LIRA)');
    expect(objectName(choices, 'space', '2')).toBe('Removed item');
    expect(objectName(choices, 'project', '1')).toBe('Removed item');
  });
});

describe('how much someone reaches', () => {
  it('counts by kind with singular and plural words, in a fixed order', () => {
    const rows = accessFor({ type: 'user', id: 'u1', teamIds: ['t1'] }, [g('a', 'user', 'u1', '1'), g('b', 'user', 'u1', '2'), { ...g('c', 'team', 't1', 'p'), kind: 'project' }], teams);
    expect(reachSummary(rows)).toBe('2 spaces, 1 project');
  });
  it('says so when nothing is shared', () => {
    expect(reachSummary([])).toBe('Nothing shared yet');
  });
});

describe('the letters in a person circle', () => {
  it('uses the first and last word of the name, the start of a single word, or the address', () => {
    expect(initialsOf('Asha Rao')).toBe('AR');
    expect(initialsOf('Mary Ann Smith')).toBe('MS');
    expect(initialsOf('Olive')).toBe('OL');
    expect(initialsOf('', 'chen.vo@acme.co')).toBe('CV');
    expect(initialsOf('')).toBe('?');
  });
});

describe('one cell of the access matrix', () => {
  const on = [g('a', 'user', 'u1', '1'), { ...g('b', 'team', 't1', '1'), level: 'edit' as const }, { ...g('c', 'team', 't2', '1'), level: 'manage' as const }];
  const both: Team[] = [{ id: 't1', name: 'QA', memberIds: [] }, { id: 't2', name: 'Ops', memberIds: [] }];
  it('has the own grant of the person, and the best level a team of theirs gives, with the name of the team', () => {
    const cell = cellFor({ type: 'user', id: 'u1', teamIds: ['t1', 't2'] }, 'space', '1', on, both);
    expect(cell.direct?.id).toBe('a');
    expect(cell.inherited).toEqual({ level: 'manage', via: 'Ops' });
  });
  it('has nothing for another thing, another kind or a team the person is not in', () => {
    expect(cellFor({ type: 'user', id: 'u1', teamIds: [] }, 'space', '1', on, both).inherited).toBeNull();
    expect(cellFor({ type: 'user', id: 'u1', teamIds: ['t1'] }, 'space', '2', on, both)).toEqual({ direct: null, inherited: null });
    expect(cellFor({ type: 'user', id: 'u1', teamIds: ['t1'] }, 'project', '1', on, both)).toEqual({ direct: null, inherited: null });
  });
  it('never takes access from another team, only the own grant of the team as direct', () => {
    expect(cellFor({ type: 'team', id: 't1' }, 'space', '1', on, both)).toMatchObject({ direct: { id: 'b' }, inherited: null });
  });
});
