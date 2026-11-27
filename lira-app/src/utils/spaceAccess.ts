import type { Issue } from '../types/issue';
import type { Space } from '../types/space';
import { isHosted } from './edition';

/** Whether the person may change tickets of this space. The local edition has one person who may do everything; the server still decides in the hosted one. */
export const canEditSpace = (space: Space | undefined): boolean => !isHosted() || space?.myLevel === 'edit' || space?.myLevel === 'manage';

/** Splits tickets into those the person may change and those they may not, by the space each belongs to. */
export function splitByAccess(issues: readonly Issue[], spaces: readonly Space[]): { editable: Issue[]; locked: Issue[] } {
  const bySpace = new Map(spaces.map(s => [s.id, s]));
  const editable: Issue[] = []; const locked: Issue[] = [];
  for (const i of issues) (canEditSpace(bySpace.get(i.spaceId)) ? editable : locked).push(i);
  return { editable, locked };
}
