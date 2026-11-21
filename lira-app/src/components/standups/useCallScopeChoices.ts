import { useMemo } from 'react';
import { useAllIssues } from '../../hooks/useIssues';
import { readProjects } from '../../hooks/useProjects';
import { useSpaces } from '../../hooks/useSpaces';
import type { CallScope } from '../../utils/callScopes';
import { allSprintKeys, sprintName } from '../../utils/sprintUtils';

/**
 * What a call can be for, as the Manage calls page offers it: the whole organisation, then each space, project and sprint. The ids are
 * the ones the call buttons use (space:6, project:proj-x, sprint:2026-11:all), so a call made here shows up in that button's popup.
 */
export function useCallScopeChoices(): CallScope[] {
  const spaces = useSpaces();
  const issues = useAllIssues();
  return useMemo(() => {
    const projects = readProjects(spaces);
    return [
      { type: 'org', id: '', name: 'Whole organisation (stand-up)' },
      ...spaces.map((s): CallScope => ({ type: 'space', id: `space:${s.id}`, name: s.name })),
      ...projects.map((p): CallScope => ({ type: 'project', id: `project:${p.id}`, name: p.name })),
      ...allSprintKeys(issues).map((k): CallScope => ({ type: 'sprint', id: `sprint:${k}:all`, name: sprintName(k) })),
    ];
  }, [spaces, issues]);
}
