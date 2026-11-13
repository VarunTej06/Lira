import { useEffect, useState } from 'react';
import type { Project } from '../types/project';
import type { Space } from '../types/space';
import { appStorage } from '../utils/appStorage';

const STORAGE_KEY = 'lira_projects';
const PROJECTS_EVENT = 'lira-projects-changed';

/** The space with this key, else the one at the same position, else the first. */
const spaceFor = (spaces: Space[], key: string, index: number): Space | undefined => spaces.find(s => s.key === key) || spaces[index] || spaces[0];

/** Which space a default project belongs to; with no space at all it keeps its own key and a placeholder id. */
const link = (space: Space | undefined, fallbackKey: string, fallbackId: number) => ({ key: space ? space.key : fallbackKey, spaceId: space?.id || fallbackId });

export const DEFAULT_PROJECTS = (spaces: Space[]): Project[] => [
  {
    id: 'proj-lira-core',
    name: 'Lira Core Platform',
    ...link(spaceFor(spaces, 'LIRA', 0), 'LIRA', 6),
    description: 'Enterprise-grade offline engineering workspace, reactive Kanban drag-and-drop, and dual-sync PC persistence.',
    lead: 'Varun Tej',
    repoUrl: 'https://github.com/VarunTej06/Lira',
    environments: ['Development', 'Staging', 'Production'],
    category: 'Software Engineering',
    createdAt: '2026-10-18T08:15:46.633Z',
    updatedAt: '2026-11-05T12:00:00.000Z',
  },
  {
    id: 'proj-ai-copilot',
    name: 'Lira AI Copilot & Autonomous Agent',
    ...link(spaceFor(spaces, 'AI', 1), 'AI', 1),
    description: 'Omnipresent LLM assistant with non-blocking curved dialog, subtask automation, sprint planning, and cross-space visibility.',
    lead: 'Varun Tej',
    repoUrl: 'https://github.com/VarunTej06/Lira/tree/main/src/components/ai',
    environments: ['Development', 'Staging'],
    category: 'Artificial Intelligence',
    createdAt: '2026-10-28T08:15:46.633Z',
    updatedAt: '2026-11-05T12:00:00.000Z',
  },
  {
    id: 'proj-cert-mastery',
    name: 'Cloud & DevOps Engineering Track',
    ...link(spaceFor(spaces, 'CERT', 2), 'CERT', 2),
    description: 'Certification study roadmaps, multi-cloud architectures, Databricks AI, and cloud-native Kubernetes delivery.',
    lead: 'Varun Tej',
    repoUrl: '',
    environments: ['Production'],
    category: 'DevOps & Infrastructure',
    createdAt: '2026-10-20T08:15:46.633Z',
    updatedAt: '2026-11-05T12:00:00.000Z',
  },
];

/** Read projects from storage; seeds the defaults the first time (when spaces are known). */
export function readProjects(spaces: Space[] = []): Project[] {
  try {
    const raw = appStorage.get(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to parse lira_projects', e);
  }
  if (spaces.length === 0) return [];
  const defaults = DEFAULT_PROJECTS(spaces);
  writeProjects(defaults);
  return defaults;
}

/** Persist projects and tell every listener (sidebar, overview…) to refresh. */
export function writeProjects(list: Project[]): void {
  try {
    appStorage.set(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save lira_projects', e);
  }
  window.dispatchEvent(new Event(PROJECTS_EVENT));
}

/** Live list of projects, shared across the whole app. */
export function useProjects(spaces: Space[]): Project[] {
  const [projects, setProjects] = useState<Project[]>(() => readProjects(spaces));
  const hasSpaces = spaces.length > 0;
  useEffect(() => {
    const refresh = () => setProjects(readProjects(spaces));
    refresh();
    window.addEventListener(PROJECTS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PROJECTS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSpaces]);
  return projects;
}
