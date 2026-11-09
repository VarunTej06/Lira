import { describe, expect, it } from 'vitest';
import { narrowOptions, panelStyle } from './filterOptions';

const opts = [{ label: 'Bug' }, { label: 'Backend' }, { label: 'UI' }];

describe('narrowOptions', () => {
  it('gives every option when nothing is typed', () => {
    expect(narrowOptions(opts, '')).toBe(opts);
    expect(narrowOptions(opts, '   ')).toBe(opts);
  });
  it('keeps options that contain the text, ignoring case and outer spaces', () => {
    expect(narrowOptions(opts, ' B ').map(o => o.label)).toEqual(['Bug', 'Backend']);
    expect(narrowOptions(opts, 'ui').map(o => o.label)).toEqual(['UI']);
  });
  it('gives nothing when nothing matches', () => {
    expect(narrowOptions(opts, 'zzz')).toEqual([]);
  });
});

describe('panelStyle', () => {
  it('is hidden at the corner until it has a position', () => {
    expect(panelStyle(null)).toMatchObject({ position: 'fixed', left: 0, visibility: 'hidden', transformOrigin: 'top left', zIndex: 300 });
  });
  it('opens downward from a top position', () => {
    expect(panelStyle({ top: 40, left: 10, maxHeight: 300 })).toMatchObject({ top: 40, left: 10, maxHeight: 300, visibility: 'visible', transformOrigin: 'top left' });
  });
  it('opens upward from a bottom position', () => {
    const s = panelStyle({ bottom: 20, left: 10, maxHeight: 300 });
    expect(s).toMatchObject({ bottom: 20, visibility: 'visible', transformOrigin: 'bottom left' });
    expect(s.top).toBeUndefined();
  });
});
