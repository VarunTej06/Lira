import { describe, expect, it } from 'vitest';
import { templateFor, wordCount, wrapSelection } from './docsText';

describe('templateFor', () => {
  it('names the space everywhere, or Workspace', () => {
    expect(templateFor('Alpha')).toContain('for **Alpha**');
    expect(templateFor(undefined)).toContain('for **Workspace**');
    expect(templateFor('Alpha')).not.toContain('[SPACE_NAME]');
  });
});

describe('wordCount', () => {
  it('counts words separated by any whitespace', () => expect(wordCount(' one  two\nthree ')).toBe(3));
  it('is 0 for blank text', () => { expect(wordCount('')).toBe(0); expect(wordCount('  \n ')).toBe(0); });
});

describe('wrapSelection', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapSelection('hello world', 6, 11, '**', '**')).toEqual({ text: 'hello **world**', selectStart: 8, selectEnd: 13 });
  });
  it('wraps the word "text" with an empty selection and selects it', () => {
    expect(wrapSelection('ab', 1, 1, '*', '*')).toEqual({ text: 'a*text*b', selectStart: 2, selectEnd: 6 });
  });
  it('adds just a prefix', () => {
    expect(wrapSelection('item', 0, 4, '- [ ] ', '').text).toBe('- [ ] item');
  });
});

