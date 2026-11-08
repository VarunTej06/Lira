import { useEffect, useState } from 'react';
import type { Project } from '../types/project';
import type { Space } from '../types/space';

const STORAGE_KEY = 'lira_projects';
export const PROJECTS_EVENT = 'lira-projects-changed';

export const DEFAULT_PROJECTS = (spaces: Space[]): Project[] => {
  const liraSpace = spaces.find(s => s.key === 'LIRA') || spaces[0];
  const aiSpace = spaces.find(s => s.key === 'AI') || spaces[1] || spaces[0];
  const certSpace = spaces.find(s => s.key === 'CERT') || spaces[2] || spaces[0];

  return [
    {
      id: 'proj-lira-core',
      name: 'Lira Core Platform',
      key: liraSpace ? liraSpace.key : 'LIRA',
      description: 'Enterprise-grade offline engineering workspace, reactive Kanban drag-and-drop, and dual-sync PC persistence.',
      lead: 'Varun Tej',
      spaceId: liraSpace?.id || 6,
      repoUrl: 'https://github.com/VarunTej06/Lira',
      environments: ['Development', 'Staging', 'Production'],
      category: 'Software Engineering',
      createdAt: '2026-10-18T08:15:46.633Z',
      updatedAt: '2026-11-05T12:00:00.000Z',
    },
    {
      id: 'proj-ai-copilot',
      name: 'Lira AI Copilot & Autonomous Agent',
      key: aiSpace ? aiSpace.key : 'AI',
      description: 'Omnipresent LLM assistant with non-blocking curved dialog, subtask automation, sprint planning, and cross-space visibility.',
      lead: 'Varun Tej',
      spaceId: aiSpace?.id || 1,
      repoUrl: 'https://github.com/VarunTej06/Lira/tree/main/src/components/ai',
      environments: ['Development', 'Staging'],
      category: 'Artificial Intelligence',
      createdAt: '2026-10-28T08:15:46.633Z',
      updatedAt: '2026-11-05T12:00:00.000Z',
    },
    {
      id: 'proj-cert-mastery',
      name: 'Cloud & DevOps Engineering Track',
      key: certSpace ? certSpace.key : 'CERT',
      description: 'Certification study roadmaps, multi-cloud architectures, Databricks AI, and cloud-native Kubernetes delivery.',
      lead: 'Varun Tej',
      spaceId: certSpace?.id || 2,
      repoUrl: '',
      environments: ['Production'],
      category: 'DevOps & Infrastructure',
      createdAt: '2026-10-20T08:15:46.633Z',
      updatedAt: '2026-11-05T12:00:00.000Z',
    },
  ];
};

/** Read projects from storage; seeds the defaults the first time (when spaces are known). */
export function readProjects(spaces: Space[] = []): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
