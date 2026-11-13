import { beforeEach, describe, expect, it } from 'vitest';
import { addCustomSprint, getPlannedSprints, getSprintDefs, getSprintMeta, getSprintSpaces, MAX_SPRINT_DAYS } from '../../utils/sprintUtils';
import { checkDraft, createSprintFromDraft, type SprintDraft } from './sprintDraft';

beforeEach(() => localStorage.clear());

const draft = (over: Partial<SprintDraft> = {}): SprintDraft => ({ kind: 'monthly', month: '2027-02', start: '2027-03-01', days: 10, name: '', goal: '', spaceIds: [], ...over });

describe('checkDraft', () => {
  it('lets a monthly sprint through with no other checks', () => {
    expect(checkDraft({ kind: 'monthly', start: 'garbage', days: 0 })).toMatchObject({ custom: false, length: 0, canSubmit: true, customEnd: null });
  });

  it('works out the last day of a weekly sprint', () => {
    const c = checkDraft({ kind: 'weekly', start: '2027-03-01', days: 10 });
    expect(c).toMatchObject({ custom: true, length: 7, startValid: true, canSubmit: true });
    expect(c.customEnd!.getDate()).toBe(7);
  });

  it('uses the number of days for a "days" sprint', () => {
    const c = checkDraft({ kind: 'days', start: '2027-03-01', days: 3 });
    expect(c.length).toBe(3);
    expect(c.customEnd!.getDate()).toBe(3);
  });

  it.each(['', '2027-3-1', '01/03/2027', '2027-13-45x'])('does not accept the start "%s"', start => {
    const c = checkDraft({ kind: 'weekly', start, days: 10 });
    expect(c.startValid).toBe(false);
    expect(c.canSubmit).toBe(false);
    expect(c.customEnd).toBeNull();
  });

  it('accepts only 1 to the maximum number of days', () => {
    expect(checkDraft({ kind: 'days', start: '2027-03-01', days: 0 }).canSubmit).toBe(false);
    expect(checkDraft({ kind: 'days', start: '2027-03-01', days: 1 }).canSubmit).toBe(true);
    expect(checkDraft({ kind: 'days', start: '2027-03-01', days: MAX_SPRINT_DAYS }).canSubmit).toBe(true);
    expect(checkDraft({ kind: 'days', start: '2027-03-01', days: MAX_SPRINT_DAYS + 1 }).canSubmit).toBe(false);
  });

  it('finds an overlap with an existing sprint and refuses it', () => {
    addCustomSprint({ start: '2027-03-01', kind: 'weekly', days: 7, name: '' });
    const c = checkDraft({ kind: 'weekly', start: '2027-03-05', days: 10 });
    expect(c.overlap).toBeTruthy();
    expect(c.canSubmit).toBe(false);
    expect(checkDraft({ kind: 'weekly', start: '2027-03-08', days: 10 }).overlap).toBeUndefined();
  });
});

describe('createSprintFromDraft', () => {
  it('plans a monthly sprint and returns its month', () => {
    expect(createSprintFromDraft(draft(), 3)).toBe('2027-02');
    expect(getPlannedSprints()).toContain('2027-02');
  });

  it('creates a custom sprint with its own key and definition', () => {
    const key = createSprintFromDraft(draft({ kind: 'weekly', name: 'Alpha' }), 3)!;
    expect(key).toContain('2027-03-01');
    expect(Object.keys(getSprintDefs())).toContain(key);
  });

  it('keeps a trimmed goal, and no goal when it is blank', () => {
    const a = createSprintFromDraft(draft({ goal: '  Ship it  ' }), 3)!;
    expect(getSprintMeta('all', a).goal).toBe('Ship it');
    const b = createSprintFromDraft(draft({ month: '2027-04', goal: '   ' }), 3)!;
    expect(getSprintMeta('all', b).goal).toBeUndefined();
  });

  it('limits the sprint to some spaces only when the list is a real subset', () => {
    const subset = createSprintFromDraft(draft({ month: '2027-05', spaceIds: [1, 2] }), 3)!;
    expect(getSprintSpaces(subset)).toEqual([1, 2]);
    const all = createSprintFromDraft(draft({ month: '2027-06', spaceIds: [1, 2, 3] }), 3)!;
    expect(getSprintSpaces(all)).toBeNull();
    const none = createSprintFromDraft(draft({ month: '2027-07', spaceIds: [] }), 3)!;
    expect(getSprintSpaces(none)).toBeNull();
  });

  it('returns null when a custom sprint cannot be created', () => {
    addCustomSprint({ start: '2027-03-01', kind: 'weekly', days: 7, name: '' });
    expect(createSprintFromDraft(draft({ kind: 'weekly', start: '2027-03-02' }), 3)).toBeNull();
  });
});
