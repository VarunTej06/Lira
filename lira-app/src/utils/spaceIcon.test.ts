import { describe, expect, it } from 'vitest';
import { DEFAULT_SPACE_ICON, SPACE_ICON_KEYS, spaceIconKey } from './spaceIcon';

describe('spaceIconKey', () => {
  it('keeps every icon name it offers, each once', () => {
    expect(new Set(SPACE_ICON_KEYS).size).toBe(SPACE_ICON_KEYS.length);
    for (const key of SPACE_ICON_KEYS) expect(spaceIconKey(key)).toBe(key);
  });

  it('shows the matching icon for the emoji older spaces saved', () => {
    expect(spaceIconKey('\u{1F4CB}')).toBe('clipboard');
    expect(spaceIconKey('\u{2728}')).toBe('sparkles');
    expect(spaceIconKey('\u{1F3C6}')).toBe('trophy');
    expect(spaceIconKey('\u{1F4DA}')).toBe('book');
    expect(spaceIconKey('\u{1F680}')).toBe('rocket');
    expect(spaceIconKey('\u{1F3AF}')).toBe('target');
    expect(spaceIconKey('\u{26A1}')).toBe('zap');
  });

  it('ignores the invisible mark some emoji carry', () => {
    expect(spaceIconKey('\u{1F324}\u{FE0F}')).toBe('cloud');
    expect(spaceIconKey('\u{26A1}\u{FE0F}')).toBe('zap');
  });

  it('falls back to the folder for nothing, an unknown emoji or any other text', () => {
    for (const saved of [undefined, null, '', '  ', '\u{1F984}', 'x', 'constructor', '__proto__', '<img onerror=1>']) {
      expect(spaceIconKey(saved)).toBe(DEFAULT_SPACE_ICON);
    }
  });
});
