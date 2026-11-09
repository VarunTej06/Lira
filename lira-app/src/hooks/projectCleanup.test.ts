import { beforeEach, describe, expect, it } from 'vitest';
import { appStorage } from '../utils/appStorage';
import { removeProjectData } from './projectCleanup';

beforeEach(() => localStorage.clear());

const stored = () => JSON.parse(appStorage.get('lira_projects') || '[]') as { id: string }[];

describe('removeProjectData', () => {
  it('removes the project, its settings and its team, and keeps other projects', () => {
    appStorage.set('lira_projects', JSON.stringify([{ id: 'a' }, { id: 'b' }]));
    appStorage.set('lira_project_settings_a', '{}');
    appStorage.set('lira_scope_team:project:a', '[]');
    appStorage.set('lira_project_settings_b', '{}');
    expect(removeProjectData('a')).toBe(true);
    expect(stored().map(p => p.id)).toEqual(['b']);
    expect(appStorage.get('lira_project_settings_a')).toBeNull();
    expect(appStorage.get('lira_scope_team:project:a')).toBeNull();
    expect(appStorage.get('lira_project_settings_b')).toBe('{}');
  });
  it('still clears the settings when no project list was saved', () => {
    appStorage.set('lira_project_settings_a', '{}');
    expect(removeProjectData('a')).toBe(true);
    expect(appStorage.get('lira_project_settings_a')).toBeNull();
  });
  it('says so, and changes nothing, when the saved list is broken', () => {
    appStorage.set('lira_projects', '{broken');
    appStorage.set('lira_project_settings_a', '{}');
    expect(removeProjectData('a')).toBe(false);
    expect(appStorage.get('lira_project_settings_a')).toBe('{}');
  });
});
