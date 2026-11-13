import { describe, expect, it } from 'vitest';
import { cleanProjectKey, suggestProjectKey } from './projectKey';

describe('Project key', () => {
  it('uses the first four letters of a one-word name', () => {
    expect(suggestProjectKey('Atmos')).toBe('ATMO');
  });

  it('uses the first letter of each word, up to five', () => {
    expect(suggestProjectKey('MLOps Automated Pipeline')).toBe('MAP');
    expect(suggestProjectKey('one two three four five six')).toBe('OTTFF');
  });

  it('drops anything that is not a letter or digit, and copes with an empty name', () => {
    expect(suggestProjectKey('  ')).toBe('');
    expect(suggestProjectKey('Q&A Hub')).toBe('QH');
  });

  it('cleans what is typed into the key box', () => {
    expect(cleanProjectKey('ab-c d1234567')).toBe('ABCD12');
  });
});
