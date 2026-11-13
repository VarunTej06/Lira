import { describe, expect, it } from 'vitest';
import { placeCalendar, placeMenu, placePanel } from './filterPlacement';

const view = { width: 1000, height: 800 };
const button = (over: Partial<{ left: number; top: number; bottom: number }> = {}) => ({ left: 100, top: 100, bottom: 130, ...over });

describe('placePanel', () => {
  it('opens under the button when the whole list fits there', () => {
    expect(placePanel(button(), 240, 200, view)).toEqual({ top: 136, left: 100, maxHeight: 360 });
  });

  it('keeps the list inside the window on the left and on the right', () => {
    expect(placePanel(button({ left: -50 }), 240, 200, view).left).toBe(8);
    expect(placePanel(button({ left: 950 }), 240, 200, view).left).toBe(1000 - 240 - 8);
  });

  it('opens above when there is more room there and the list does not fit below', () => {
    const pos = placePanel(button({ top: 700, bottom: 730 }), 240, 300, view);
    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(800 - 700 + 6);
    expect(pos.maxHeight).toBe(360);
  });

  it('stays below when it does not fit but there is still more room below than above', () => {
    const pos = placePanel(button({ top: 100, bottom: 130 }), 240, 900, { width: 1000, height: 300 });
    expect(pos.top).toBe(136);
  });

  it('is never taller than the room on its side, and never shorter than 120', () => {
    expect(placePanel(button({ top: 20, bottom: 50 }), 240, 900, { width: 1000, height: 150 }).maxHeight).toBe(120);
    expect(placePanel(button(), 240, 900, view).maxHeight).toBe(360);
  });

  it('caps the height it asks for at 360 when judging whether the list fits', () => {
    // 700px of list, but only 360 is ever shown; 400px of room below is enough
    const pos = placePanel(button({ top: 100, bottom: 330 }), 240, 700, { width: 1000, height: 740 });
    expect(pos.top).toBe(336);
  });
});

describe('placeCalendar', () => {
  const view = { width: 1000, height: 800 };
  const panel = { width: 272, height: 300 };

  it('opens under the field when it fits', () => {
    expect(placeCalendar({ left: 100, top: 100, bottom: 130 }, panel, view)).toEqual({ top: 136, left: 100 });
  });

  it('opens above the field when there is no room below', () => {
    expect(placeCalendar({ left: 100, top: 600, bottom: 630 }, panel, view)).toEqual({ top: 600 - 6 - 300, left: 100 });
  });

  it('never goes above the top margin', () => {
    expect(placeCalendar({ left: 100, top: 20, bottom: 50 }, panel, { width: 1000, height: 200 }).top).toBe(8);
  });

  it('stays inside the window on the left and the right', () => {
    expect(placeCalendar({ left: -40, top: 100, bottom: 130 }, panel, view).left).toBe(8);
    expect(placeCalendar({ left: 900, top: 100, bottom: 130 }, panel, view).left).toBe(1000 - 272 - 8);
  });
});

describe('placeMenu', () => {
  const menu = { width: 200, height: 100 };
  const win = { width: 1000, height: 800 };
  it('opens under the button, right-aligned to it', () => {
    expect(placeMenu({ top: 100, bottom: 120, right: 300 }, menu, win)).toEqual({ top: 124, left: 100 });
  });
  it('opens above the button when there is no room below', () => {
    expect(placeMenu({ top: 700, bottom: 720, right: 300 }, menu, win).top).toBe(700 - 4 - 100);
  });
  it('never goes above the top margin', () => {
    expect(placeMenu({ top: 20, bottom: 40, right: 300 }, { width: 200, height: 100 }, { width: 1000, height: 120 }).top).toBe(8);
  });
  it('stays inside the window on the left and the right', () => {
    expect(placeMenu({ top: 100, bottom: 120, right: 50 }, menu, win).left).toBe(8);
    expect(placeMenu({ top: 100, bottom: 120, right: 1200 }, menu, win).left).toBe(1000 - 200 - 8);
  });
});
