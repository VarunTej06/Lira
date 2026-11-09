import { describe, expect, it } from 'vitest';
import { dashboardJsonName } from './snapshot';

describe('dashboardJsonName', () => {
  it('lower-cases, joins runs of other characters with a dash and adds the extension', () => {
    expect(dashboardJsonName('My Big  Board!')).toBe('my-big-board-.dashboard.json');
    expect(dashboardJsonName('Sprint 12')).toBe('sprint-12.dashboard.json');
  });
});
