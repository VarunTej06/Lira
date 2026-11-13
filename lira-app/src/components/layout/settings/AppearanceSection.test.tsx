import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount } from '../../../test/render';
import { SettingsModal } from '../SettingsModal';
import { getLightPalette, getTheme } from '../../../utils/theme';

const root = document.documentElement;

beforeEach(() => { localStorage.clear(); root.classList.remove('dark'); delete root.dataset.palette; });
afterEach(cleanup);

const card = (title: string | RegExp) => byText('button[aria-pressed]', title)!;
const pressed = (title: string | RegExp) => card(title).getAttribute('aria-pressed') === 'true';
const save = () => byText<HTMLButtonElement>('button', 'Save')!;

function open() {
  const onClose = vi.fn();
  mount(<SettingsModal isOpen onClose={onClose} />);
  return onClose;
}

describe('Appearance settings', () => {
  it('opens on the saved theme (dark at first) and offers no light palettes while Dark is chosen', () => {
    open();
    expect(pressed(/^Dark Mode/)).toBe(true);
    expect(pressed(/^Light Mode/)).toBe(false);
    expect(byText('h4', 'Choose a light palette')).toBeUndefined();
    expect(save().disabled).toBe(true);
  });

  it('asks which of the two light palettes when Light is chosen, with Sorrel picked first', async () => {
    open();
    await click(card(/^Light Mode/));
    expect(byText('h4', 'Choose a light palette')).toBeDefined();
    expect(pressed(/^Sorrel/)).toBe(true);
    expect(pressed(/^Fawn/)).toBe(false);
  });

  it('shows the three colours of each theme by name', async () => {
    open();
    await click(card(/^Light Mode/));
    const names = (title: RegExp) => Array.from(card(title).querySelectorAll('[title]')).map(e => e.getAttribute('title'));
    expect(names(/^Dark Mode/)).toEqual(['Black', 'Silver', 'Yellow']);
    expect(names(/^Sorrel/)).toEqual(['Sage', 'Off-White', 'Tomato Red']);
    expect(names(/^Fawn/)).toEqual(['Brown', 'Cream', 'Baby Blue']);
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
    await click(card(/^Fawn/));
    await click(save());
    expect(getTheme()).toBe('light');
    expect(getLightPalette()).toBe('fawn');
    expect(root.dataset.palette).toBe('fawn');
    expect(root.classList.contains('dark')).toBe(false);
    expect(onClose).toHaveBeenCalled();
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
    expect(getLightPalette()).toBe('sorrel');
  });

  it('has no accent colour picker: each theme keeps its own button colour', () => {
    open();
    expect(document.querySelector('input[type="color"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/accent/i);
  });
});
