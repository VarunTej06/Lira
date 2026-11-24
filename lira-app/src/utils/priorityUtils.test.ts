import { describe, expect, it } from 'vitest';
import { getPriorityConfig, PRIORITY_CONFIG } from './priorityUtils';

describe('the look of each priority', () => {
  it('has a name and colours for each of the five', () => {
    expect(Object.keys(PRIORITY_CONFIG)).toEqual(['highest', 'high', 'medium', 'low', 'lowest']);
    for (const c of Object.values(PRIORITY_CONFIG)) expect(c.label && c.color && c.bgColor && c.borderColor).toBeTruthy();
    expect(getPriorityConfig('highest').label).toBe('Highest');
  });
  it('falls back to Medium for a priority that is not known, so a screen never breaks on old data', () => {
    expect(getPriorityConfig('urgent' as never)).toBe(PRIORITY_CONFIG.medium);
  });
});
