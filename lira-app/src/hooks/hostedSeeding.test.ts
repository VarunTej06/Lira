import { describe, expect, it, vi } from 'vitest';
import { makeSpace } from '../test/factories';
import { appStorage } from '../utils/appStorage';
import { readProjects } from './useProjects';
import { readRoadmaps } from './useRoadmaps';

vi.mock('../utils/edition', () => ({ isHosted: () => true }));

describe('a new hosted account', () => {
  it('starts with no sample projects, even when spaces exist, and saves nothing', () => {
    localStorage.clear();
    expect(readProjects([makeSpace({ id: 1, key: 'ONE' })])).toEqual([]);
    expect(appStorage.get('lira_projects')).toBeNull();
  });

  it('starts with no sample roadmap, and saves nothing', () => {
    localStorage.clear();
    expect(readRoadmaps()).toEqual([]);
    expect(appStorage.get('lira_roadmaps')).toBeNull();
  });
});
