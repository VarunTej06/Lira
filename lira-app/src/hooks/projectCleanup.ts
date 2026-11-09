import type { Project } from '../types/project';
import { appStorage } from '../utils/appStorage';
import { writeProjects } from './useProjects';

/**
 * Removes a project, its saved settings and its team. Its tickets stay in the space.
 * Returns false when storage could not be updated, so the caller can say so.
 */
export function removeProjectData(projectId: string): boolean {
  try {
    const raw = appStorage.get('lira_projects');
    if (raw) writeProjects((JSON.parse(raw) as Project[]).filter(p => p.id !== projectId));
    appStorage.remove(`lira_project_settings_${projectId}`);
    appStorage.remove(`lira_scope_team:project:${projectId}`);
    return true;
  } catch {
    return false;
  }
}
