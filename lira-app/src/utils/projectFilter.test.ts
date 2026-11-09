import { describe, expect, it } from 'vitest';
import { filterProjects, projectIssues } from './projectFilter';
import { makeIssue } from '../test/factories';
import type { Project } from '../types/project';

const project = (over: Partial<Project>): Project => ({
  id: 'p', name: 'Project', key: 'PRJ', description: '', lead: 'Sam', spaceId: 1, repoUrl: '', environments: [], category: 'Software Engineering',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over,
});

const list = [
  project({ id: 'a', name: 'Atmos', key: 'ATM', lead: 'Priya', description: 'Weather app', spaceId: 1, updatedAt: '2026-03-01T00:00:00Z' }),
  project({ id: 'b', name: 'Billing', key: 'BIL', lead: 'Sam', spaceId: 2, updatedAt: '2026-05-01T00:00:00Z' }),
  project({ id: 'c', name: 'Charts', key: 'CHT', lead: 'Sam', spaceId: 2, updatedAt: '2026-04-01T00:00:00Z' }),
];
const ids = (ps: Project[]) => ps.map(p => p.id);

describe('Projects list', () => {
  it('searches name, key, lead and description', () => {
    expect(ids(filterProjects(list, 'weather', 'all', 'name'))).toEqual(['a']);
    expect(ids(filterProjects(list, 'bil', 'all', 'name'))).toEqual(['b']);
    expect(ids(filterProjects(list, 'sam', 'all', 'name'))).toEqual(['b', 'c']);
  });

  it('filters by space', () => {
    expect(ids(filterProjects(list, '', '2', 'name'))).toEqual(['b', 'c']);
  });

  it('sorts recent first, by name, or by key, without changing the list it was given', () => {
    expect(ids(filterProjects(list, '', 'all', 'recent'))).toEqual(['b', 'c', 'a']);
    expect(ids(filterProjects(list, '', 'all', 'key'))).toEqual(['a', 'b', 'c']);
    expect(ids(list as Project[])).toEqual(['a', 'b', 'c']);
  });

  it("counts a project's tickets by space or by key prefix", () => {
    const p = project({ spaceId: 1, key: 'ATM' });
    const tickets = [makeIssue({ id: 1, spaceId: 1, key: 'X-1' }), makeIssue({ id: 2, spaceId: 9, key: 'ATM-4' }), makeIssue({ id: 3, spaceId: 9, key: 'ATMOS-1' })];
    expect(projectIssues(p, tickets).map(i => i.id)).toEqual([1, 2]);
  });
});
