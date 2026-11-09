import { describe, expect, it } from 'vitest';
import { typedLabels, visibleHints } from './suggestionRules';

const s = (over: object = {}) => ({ labels: [], duplicates: [], ...over });
const cur = (over: object = {}) => ({ labels: '', priority: 'medium' as const, type: 'task', parentId: undefined, ...over });

describe('typedLabels', () => {
  it('splits on commas, trims, lower-cases and drops blanks', () => {
    expect([...typedLabels(' Bug, UI ,, ')]).toEqual(['bug', 'ui']);
    expect(typedLabels('').size).toBe(0);
  });
});

describe('visibleHints', () => {
  it('has nothing to show for an empty suggestion', () => {
    expect(visibleHints(s(), cur())).toMatchObject({ labelChips: [], showPriority: false, showEpic: false, any: false });
  });
  it('hides label chips that are already typed, ignoring case', () => {
    expect(visibleHints(s({ labels: ['Bug', 'ui'] }), cur({ labels: 'bug' })).labelChips).toEqual(['ui']);
  });
  it('shows the priority only when it differs', () => {
    expect(visibleHints(s({ priority: 'high' }), cur()).showPriority).toBe(true);
    expect(visibleHints(s({ priority: 'medium' }), cur()).showPriority).toBe(false);
    expect(visibleHints(s(), cur()).showPriority).toBe(false);
  });
  it('shows the epic for tasks and bugs only, and not when already under it', () => {
    const epic = { id: 5 };
    expect(visibleHints(s({ epic }), cur()).showEpic).toBe(true);
    expect(visibleHints(s({ epic }), cur({ type: 'bug' })).showEpic).toBe(true);
    expect(visibleHints(s({ epic }), cur({ type: 'epic' })).showEpic).toBe(false);
    expect(visibleHints(s({ epic }), cur({ type: 'subtask' })).showEpic).toBe(false);
    expect(visibleHints(s({ epic }), cur({ parentId: 5 })).showEpic).toBe(false);
    expect(visibleHints(s({ epic: null }), cur()).showEpic).toBe(false);
  });
  it('counts duplicates as something to show', () => {
    expect(visibleHints(s({ duplicates: [{}] }), cur()).any).toBe(true);
  });
});
