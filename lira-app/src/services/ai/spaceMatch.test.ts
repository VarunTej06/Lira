import { describe, expect, it } from 'vitest';
import type { Space } from '../../types/space';
import { escapeRegex, findTargetSpace } from './spaceMatch';

const space = (id: number, key: string, name: string): Space => ({ id, key, name, icon: 'x', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) });
const spaces = [
  space(1, 'AP', 'Atmos - Weather App'),
  space(2, 'CERT', 'Certifications'),
  space(3, 'IG', 'Interview Guide'),
  space(4, 'AI', 'AI Projects'),
  space(5, 'GEN', 'General Tasks'),
  space(6, 'LIRA', 'Lira'),
];
const find = (text: string, list = spaces) => findTargetSpace(text, list)?.key;

describe('findTargetSpace', () => {
  it('matches a space key as a whole word', () => {
    expect(find('show tickets in AP')).toBe('AP');
    expect(find('tasks for cert')).toBe('CERT');
  });

  it('does not match a key buried inside another word', () => {
    expect(find('what is happening')).toBeUndefined(); // "ap" is inside "happening"
  });

  it('matches the full space name', () => {
    expect(find('open the interview guide board')).toBe('IG');
    expect(find('list atmos - weather app tickets')).toBe('AP');
  });

  it('matches a significant word of a multi-word name, ignoring filler words', () => {
    expect(find('anything about weather')).toBe('AP');
    expect(find('the app for me')).toBeUndefined(); // "app" is a filler word
  });

  it('understands the short names people use', () => {
    expect(find('my certification plan')).toBe('CERT');
    expect(find('machine learning work')).toBe('AI');
    expect(find('general stuff')).toBe('GEN');
  });

  it('tries key, then full name, then name words, then aliases', () => {
    const list = [space(1, 'XX', 'Weather Station'), space(2, 'WS', 'Other')];
    // "ws" is a key: it wins over the word "weather" that also matches space 1
    expect(find('ws weather', list)).toBe('WS');
    expect(find('weather only', list)).toBe('XX');
  });

  it('works for spaces added later, with no code change', () => {
    const later = [...spaces, space(9, 'FIN', 'Finance Planning')];
    expect(find('budget in FIN', later)).toBe('FIN');
    expect(find('finance questions', later)).toBe('FIN');
  });

  it('returns nothing when no space is meant', () => {
    expect(find('hello there')).toBeUndefined();
    expect(find('anything', [])).toBeUndefined();
  });
});

describe('escapeRegex', () => {
  it('escapes characters that mean something in a pattern', () => {
    expect(new RegExp(escapeRegex('a.b*c(d)')).test('a.b*c(d)')).toBe(true);
    expect(new RegExp(escapeRegex('a.b')).test('axb')).toBe(false);
  });
});
