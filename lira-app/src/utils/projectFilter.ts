import type { Project } from '../types/project';
import type { Issue } from '../types/issue';

export type ProjectSort = 'recent' | 'name' | 'key';

/** The projects matching the search words and the space filter ("all" or a space id), in the chosen order. */
export function filterProjects(projects: Project[], search: string, spaceFilter: string, sortBy: ProjectSort): Project[] {
  const q = search.trim().toLowerCase();
  const touched = (p: Project) => new Date(p.updatedAt || p.createdAt).getTime();
  return projects
    .filter(p => !q || [p.name, p.key, p.lead, p.description ?? ''].some(text => text.toLowerCase().includes(q)))
    .filter(p => spaceFilter === 'all' || p.spaceId === Number(spaceFilter))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'key' ? a.key.localeCompare(b.key) : touched(b) - touched(a));
}

/** A project's tickets: everything in its space, plus any ticket whose key starts with the project's key. */
export function projectIssues(project: Project, issues: Issue[]): Issue[] {
  return issues.filter(i => (!!project.spaceId && i.spaceId === project.spaceId) || (!!project.key && i.key.startsWith(`${project.key}-`)));
}
