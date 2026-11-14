import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, qa } from '../../../test/render';
import { SettingsModal } from '../SettingsModal';
import { getPalette, getTheme } from '../../../utils/theme';

const root = document.documentElement;

beforeEach(() => { localStorage.clear(); root.classList.remove('dark'); delete root.dataset.palette; });
afterEach(cleanup);

const card = (title: string | RegExp) => byText('button[aria-pressed]', title)!;
const pressed = (title: string | RegExp) => card(title).getAttribute('aria-pressed') === 'true';
const save = () => byText<HTMLButtonElement>('button', 'Save')!;
/** The names of the palette cards on offer (the two theme cards come first and are left out). */
const offered = () => qa('[aria-labelledby="palette-h"] button[aria-pressed]').map(b => b.textContent!.match(/^[A-Z][a-z]+/)![0]);

function open() {
  const onClose = vi.fn();
  mount(<SettingsModal isOpen onClose={onClose} />);
  return onClose;
}

describe('Appearance settings', () => {
  it('opens on the saved theme (dark at first) with its two palettes, Pace chosen', () => {
    open();
    expect(pressed(/^Dark Mode/)).toBe(true);
    expect(pressed(/^Light Mode/)).toBe(false);
    expect(byText('h4', 'Choose a dark palette')).toBeDefined();
    expect(offered()).toEqual(['Pace', 'Blackridge']);
    expect(pressed(/^Pace/)).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it('asks which of the four light palettes when Light is chosen, with Sorrel picked first', async () => {
    open();
    await click(card(/^Light Mode/));
    expect(byText('h4', 'Choose a light palette')).toBeDefined();
    expect(offered()).toEqual(['Sorrel', 'Fawn', 'Mossgrove', 'Tidewell']);
    expect(pressed(/^Sorrel/)).toBe(true);
  });

  it('shows the three colours of each palette by name', async () => {
    open();
    const names = (title: RegExp) => Array.from(card(title).querySelectorAll('[title]')).map(e => e.getAttribute('title'));
    expect(names(/^Pace/)).toEqual(['Black', 'Silver', 'Yellow']);
    expect(names(/^Blackridge/)).toEqual(['Jet Black', 'Smoke Grey', 'Cherry Red']);
    await click(card(/^Light Mode/));
    expect(names(/^Sorrel/)).toEqual(['Sage', 'Off-White', 'Tomato Red']);
    expect(names(/^Fawn/)).toEqual(['Brown', 'Cream', 'Baby Blue']);
    expect(names(/^Mossgrove/)).toEqual(['Emerald', 'White', 'Tangerine']);
    expect(names(/^Tidewell/)).toEqual(['Ink Navy', 'Pearl White', 'Electric Coral']);
  });

  it('the theme card shows the colours of the palette picked for it', async () => {
    open();
    await click(card(/^Blackridge/));
    expect(Array.from(card(/^Dark Mode/).querySelectorAll('[title]')).map(e => e.getAttribute('title'))).toEqual(['Jet Black', 'Smoke Grey', 'Cherry Red']);
  });

  it('changes nothing until Save is pressed', async () => {
    open();
    await click(card(/^Light Mode/));
    await click(card(/^Fawn/));
    expect(getTheme()).toBe('dark');
    expect(root.dataset.palette).toBeUndefined();
    expect(byText('span', 'Not saved yet')).toBeDefined();
  });

  it('saves the theme and the palette, applies them and closes', async () => {
    const onClose = open();
    await click(card(/^Light Mode/));
    await click(card(/^Tidewell/));
    await click(save());
    expect(getTheme()).toBe('light');
    expect(getPalette('light')).toBe('tidewell');
    expect(root.dataset.palette).toBe('tidewell');
    expect(root.classList.contains('dark')).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('a dark workspace can switch to the other dark palette', async () => {
    open();
    await click(card(/^Blackridge/));
    expect(save().disabled).toBe(false);
    await click(save());
    expect(getTheme()).toBe('dark');
    expect(getPalette('dark')).toBe('blackridge');
    expect(root.dataset.palette).toBe('blackridge');
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('keeps the palette picked for each theme while switching between Dark and Light', async () => {
    open();
    await click(card(/^Blackridge/));
    await click(card(/^Light Mode/));
    await click(card(/^Mossgrove/));
    await click(card(/^Dark Mode/));
    expect(pressed(/^Blackridge/)).toBe(true);
    await click(card(/^Light Mode/));
    expect(pressed(/^Mossgrove/)).toBe(true);
  });

  it('lets a light workspace switch palette, and reopens on the saved one', async () => {
    localStorage.setItem('lira_theme', 'light');
    localStorage.setItem('lira_light_palette', 'fawn');
    open();
    expect(pressed(/^Fawn/)).toBe(true);
    expect(save().disabled).toBe(true);
    await click(card(/^Sorrel/));
    expect(save().disabled).toBe(false);
    await click(save());
    expect(getPalette('light')).toBe('sorrel');
  });

  it('has no accent colour picker: each palette keeps its own button colour', () => {
    open();
    expect(document.querySelector('input[type="color"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/accent/i);
  });
});
