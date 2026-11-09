import { beforeEach, describe, expect, it } from 'vitest';
import type { Space } from '../types/space';
import { appStorage } from '../utils/appStorage';
import { DEFAULT_PROJECTS, readProjects, writeProjects } from './useProjects';

beforeEach(() => localStorage.clear());

const sp = (id: number, key: string) => ({ id, key, name: key }) as Space;

describe('DEFAULT_PROJECTS', () => {
  it('links each project to the space with its key', () => {
    const [lira, ai, cert] = DEFAULT_PROJECTS([sp(10, 'CERT'), sp(11, 'AI'), sp(12, 'LIRA')]);
    expect([lira.spaceId, lira.key]).toEqual([12, 'LIRA']);
    expect([ai.spaceId, ai.key]).toEqual([11, 'AI']);
    expect([cert.spaceId, cert.key]).toEqual([10, 'CERT']);
  });
  it('falls back to the space at the same position, then to the first one', () => {
    const [lira, ai, cert] = DEFAULT_PROJECTS([sp(1, 'X'), sp(2, 'Y')]);
    expect(lira.spaceId).toBe(1);
    expect(ai.spaceId).toBe(2);
    expect(cert.spaceId).toBe(1);
    expect(cert.key).toBe('X');
  });
  it('works with a single space', () => {
    expect(DEFAULT_PROJECTS([sp(5, 'ONLY')]).every(p => p.spaceId === 5 && p.key === 'ONLY')).toBe(true);
  });
  it('has the three projects with their ids', () => {
    expect(DEFAULT_PROJECTS([sp(1, 'A')]).map(p => p.id)).toEqual(['proj-lira-core', 'proj-ai-copilot', 'proj-cert-mastery']);
  });
});

describe('readProjects', () => {
  it('is empty when nothing is saved and no spaces are known', () => {
    expect(readProjects([])).toEqual([]);
    expect(appStorage.get('lira_projects')).toBeNull();
  });
  it('seeds and saves the defaults the first time spaces are known', () => {
    const list = readProjects([sp(1, 'LIRA')]);
    expect(list).toHaveLength(3);
    expect(JSON.parse(appStorage.get('lira_projects')!)).toHaveLength(3);
  });
  it('reads the saved list afterwards', () => {
    writeProjects([{ id: 'p', name: 'Mine' } as never]);
    expect(readProjects([sp(1, 'LIRA')]).map(p => p.id)).toEqual(['p']);
  });
  it('treats a broken or empty saved list as nothing saved', () => {
    appStorage.set('lira_projects', '{oops');
    expect(readProjects([])).toEqual([]);
    appStorage.set('lira_projects', '[]');
    expect(readProjects([sp(1, 'LIRA')])).toHaveLength(3);
  });
});

describe('writeProjects', () => {
  it('saves and tells the app', () => {
    let heard = 0;
    const on = () => { heard++; };
    window.addEventListener('lira-projects-changed', on);
    writeProjects([{ id: 'a' } as never]);
    window.removeEventListener('lira-projects-changed', on);
    expect(heard).toBe(1);
    expect(JSON.parse(appStorage.get('lira_projects')!)[0].id).toBe('a');
  });
});
