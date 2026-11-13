import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { parseDay, type Roadmap, type RoadmapItem } from '../../utils/roadmapUtils';

type EpicMode = 'new' | 'existing';

/** The value of the lane list that means "type a new lane". */
export const NEW_LANE = '__new';

export interface ItemSaveOptions {
  newLane?: string;
  /** 'new': create an epic in the space (Backlog). 'existing': link an epic that already exists. */
  epicMode: EpicMode | 'keep';
  existingKey?: string;
  /** The user changed the status field, so the epic's board status should follow. */
  statusChanged: boolean;
}

export interface ItemDraftInput {
  draft: RoadmapItem;
  roadmap: Roadmap;
  issues: Issue[];
  space?: Space;
  newLane: string;
  epicMode: EpicMode;
  existingKey: string;
}

/** What the open dialog means: which lane, whether the dates make sense, which epics could be linked, and whether it can be saved. */
export function checkItemDraft({ draft, roadmap, issues, space, newLane, epicMode, existingKey }: ItemDraftInput) {
  const laneValue = draft.lane === NEW_LANE ? newLane.trim() : draft.lane;
  const datesOk = parseDay(draft.end) >= parseDay(draft.start);
  const hasEpic = !!draft.epicKey;
  const needsExisting = !hasEpic && epicMode === 'existing';
  const usedElsewhere = (key: string) => roadmap.items.some(o => o.epicKey === key && o.id !== draft.id);
  const linkable = issues.filter(i => i.type === 'epic' && (!space || i.spaceId === space.id) && !usedElsewhere(i.key));
  const valid = draft.title.trim().length > 0 && datesOk && laneValue.length > 0
    && (!needsExisting || !!existingKey)
    && (hasEpic || epicMode === 'existing' || !!space);
  return {
    laneValue,
    datesOk,
    hasEpic,
    needsExisting,
    linkable,
    valid,
    others: roadmap.items.filter(i => i.id !== draft.id),
    hasChildren: draft.children.length > 0,
  };
}

/** The item to save (trimmed title, final lane) and what else the page should do about the epic, the lane and the status. */
export function buildItemSave(
  { draft, epicMode, existingKey }: Pick<ItemDraftInput, 'draft' | 'epicMode' | 'existingKey'>,
  check: Pick<ReturnType<typeof checkItemDraft>, 'laneValue' | 'hasEpic' | 'needsExisting'>,
  original: RoadmapItem | null,
  isNew: boolean,
): [RoadmapItem, ItemSaveOptions] {
  return [
    { ...draft, lane: check.laneValue, title: draft.title.trim() },
    {
      newLane: draft.lane === NEW_LANE ? check.laneValue : undefined,
      epicMode: check.hasEpic ? 'keep' : epicMode,
      existingKey: check.needsExisting ? existingKey : undefined,
      statusChanged: !isNew && !!original && original.status !== draft.status,
    },
  ];
}
