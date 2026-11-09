import {
  addCustomSprint, addPlannedSprint, findOverlap, kindLength, MAX_SPRINT_DAYS, parseDay, setSprintMeta, setSprintSpaces, type SprintKind,
} from '../../utils/sprintUtils';

/** What the person has chosen so far in the "Create sprint" dialog. */
export interface SprintDraft {
  kind: SprintKind;
  /** The month, for a monthly sprint ("2026-11"). */
  month: string;
  /** The first day, for any other kind ("2026-11-09"). */
  start: string;
  days: number;
  name: string;
  goal: string;
  spaceIds: number[];
}

export interface DraftCheck {
  /** Anything but a monthly sprint. */
  custom: boolean;
  length: number;
  startValid: boolean;
  /** The start of a sprint this one would overlap, if any. */
  overlap: string | undefined;
  /** The last day of a custom sprint, when the start is valid. */
  customEnd: Date | null;
  canSubmit: boolean;
}

/** Works out what the draft means: how long it runs, whether it is allowed, and where it ends. */
export function checkDraft({ kind, start, days }: Pick<SprintDraft, 'kind' | 'start' | 'days'>): DraftCheck {
  const custom = kind !== 'monthly';
  const length = custom ? kindLength(kind, days) : 0;
  const startValid = /^\d{4}-\d{2}-\d{2}$/.test(start) && !Number.isNaN(parseDay(start).getTime());
  const overlap = custom && startValid ? findOverlap(start, length) : undefined;
  const first = parseDay(start);
  const customEnd = custom && startValid ? new Date(first.getFullYear(), first.getMonth(), first.getDate() + length - 1) : null;
  const daysOk = kind !== 'days' || (days >= 1 && days <= MAX_SPRINT_DAYS);
  return { custom, length, startValid, overlap, customEnd, canSubmit: !custom || (startValid && !overlap && daysOk) };
}

/**
 * Saves the sprint the draft describes and returns its key, or null when it could not be created.
 * The goal is kept for all spaces; the space list is only saved when it is a real subset of `totalSpaces`.
 */
export function createSprintFromDraft(draft: SprintDraft, totalSpaces: number): string | null {
  let key: string | null;
  if (draft.kind !== 'monthly') {
    key = addCustomSprint({ start: draft.start, kind: draft.kind, days: draft.days, name: draft.name });
  } else {
    addPlannedSprint(draft.month);
    key = draft.month;
  }
  if (!key) return null;
  if (draft.goal.trim()) setSprintMeta('all', key, { goal: draft.goal.trim() });
  if (draft.spaceIds.length && draft.spaceIds.length < totalSpaces) setSprintSpaces(key, draft.spaceIds);
  return key;
}
