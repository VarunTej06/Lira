import { describe, expect, it } from 'vitest';
import { fileForKey } from './kvMirror';

/** Every rule of the table that decides which data file a saved setting lives in. */
describe('fileForKey rules', () => {
  const cases: [string, string][] = [
    ['lira_projects', 'projects'], ['lira_project_settings_p1', 'projects'],
    ['lira_roadmaps', 'roadmaps'], ['lira_dashboards', 'dashboards'],
    ['lira_sprint_meta', 'sprints'], ['lira_planned_sprints', 'sprints'], ['lira_deleted_sprints', 'sprints'], ['lira_sprint_defs', 'sprints'],
    ['lira_team_directory', 'teams'], ['lira_scope_team:space:3', 'teams'],
    ['lira_standups', 'standups'], ['lira_standup_notes', 'standups'],
    ['lira_wip_3', 'board-config'], ['lira_board_settings_3', 'board-config'], ['lira_attachments_3', 'board-config'], ['lira_docs_3', 'board-config'], ['lira_forms_3', 'board-config'],
    ['lira_gemini_api_key', 'secrets'], ['lira_ai_api_key', 'secrets'],
    ['lira_theme', 'settings'], ['lira_anything_else', 'settings'],
  ];
  it.each(cases)('%s goes to %s', (key, file) => expect(fileForKey(key)).toBe(file));

  it('keys that merely contain a known name do not match it (exact keys are exact, prefixes are prefixes)', () => {
    expect(fileForKey('lira_projects_extra')).toBe('settings');
    expect(fileForKey('x_lira_wip_3')).toBe('settings');
  });

  it('keeps API keys out of every shared file', () => {
    expect(fileForKey('lira_gemini_api_key')).toBe('secrets');
    expect(fileForKey('lira_ai_api_key')).toBe('secrets');
  });
});
