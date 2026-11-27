import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, SIZE_LABEL, SIZE_ORDER } from './types';

describe('dashboard defaults', () => {
  it('start with no narrowing at all, so a new dashboard sees everything', () => {
    expect(DEFAULT_FILTERS).toEqual({ spaceIds: [], sprint: 'all', range: 'all', assignee: 'all', priorities: [], labels: [], types: [] });
  });
  it('name every widget size, from smallest to widest', () => {
    expect(SIZE_ORDER).toEqual(['S', 'M', 'L', 'XL']);
    SIZE_ORDER.forEach(s => expect(SIZE_LABEL[s]).toBeTruthy());
    expect(SIZE_LABEL.XL).toBe('Full width');
  });
});
