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
    expect(pressed(/^Dark$/)).toBe(true);
    expect(pressed(/^Light$/)).toBe(false);
    expect(byText('h4', 'Choose a dark palette')).toBeDefined();
    expect(offered()).toEqual(['Pace', 'Blackridge']);
    expect(pressed(/^Pace/)).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it('asks which of the four light palettes when Light is chosen, with Sorrel picked first', async () => {
    open();
    await click(card(/^Light$/));
    expect(byText('h4', 'Choose a light palette')).toBeDefined();
    expect(offered()).toEqual(['Sorrel', 'Fawn', 'Mossgrove', 'Tidewell']);
    expect(pressed(/^Sorrel/)).toBe(true);
  });

  it('shows the three colours of each palette by name', async () => {
    open();
    const names = (title: RegExp) => Array.from(card(title).querySelectorAll('[title]')).map(e => e.getAttribute('title'));
    expect(names(/^Pace/)).toEqual(['Black', 'Silver', 'Yellow']);
    expect(names(/^Blackridge/)).toEqual(['Jet Black', 'Smoke Grey', 'Cherry Red']);
    await click(card(/^Light$/));
    expect(names(/^Sorrel/)).toEqual(['Sage', 'Off-White', 'Tomato Red']);
    expect(names(/^Fawn/)).toEqual(['Brown', 'Cream', 'Baby Blue']);
    expect(names(/^Mossgrove/)).toEqual(['Emerald', 'White', 'Tangerine']);
    expect(names(/^Tidewell/)).toEqual(['Ink Navy', 'Pearl White', 'Electric Coral']);
  });

  it('shows each choice as one rectangle of its three colours with no gap or border between them, and the name beside it', () => {
    open();
    const strip = card(/^Pace/).querySelector('span[aria-hidden]')!;
    expect(strip.children).toHaveLength(3);
    expect(strip.className).toContain('overflow-hidden');
    expect(strip.className).not.toMatch(/gap-|space-x/);
    expect(Array.from(strip.children).every(c => !c.className.includes('border'))).toBe(true);
    expect(card(/^Pace/).textContent).toBe('Pace'); // nothing but the name: no description in the card
    expect(card(/^Dark$/).textContent).toBe('Dark');
  });

  it('says under the choices what each colour of the chosen palette paints, and follows the choice', async () => {
    open();
    const notes = () => Array.from(document.querySelectorAll('dl div')).map(r => r.textContent);
    expect(document.querySelector('dl')!.getAttribute('aria-label')).toBe('What the Pace colours are used for');
    expect(notes()).toEqual(['Blackthe page and the panels', 'Silvertext and thin lines', 'Yellowbuttons and the selected item']);
    await click(card(/^Blackridge/));
    expect(document.querySelector('dl')!.getAttribute('aria-label')).toBe('What the Blackridge colours are used for');
    expect(notes()[2]).toBe('Cherry Redbuttons and the selected item');
    await click(card(/^Light$/));
    await click(card(/^Fawn/));
    expect(notes()).toEqual(['Browntext and the navigation', 'Creamthe page and the cards', 'Baby Bluebuttons and the selected item']);
  });

  it('the theme card shows the colours of the palette picked for it', async () => {
    open();
    await click(card(/^Blackridge/));
    expect(Array.from(card(/^Dark$/).querySelectorAll('[title]')).map(e => e.getAttribute('title'))).toEqual(['Jet Black', 'Smoke Grey', 'Cherry Red']);
  });

  it('changes nothing until Save is pressed', async () => {
    open();
    await click(card(/^Light$/));
    await click(card(/^Fawn/));
    expect(getTheme()).toBe('dark');
    expect(root.dataset.palette).toBeUndefined();
    expect(byText('span', 'Not saved yet')).toBeDefined();
  });

  it('saves the theme and the palette, applies them and closes', async () => {
    const onClose = open();
    await click(card(/^Light$/));
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
    await click(card(/^Light$/));
    await click(card(/^Mossgrove/));
    await click(card(/^Dark$/));
    expect(pressed(/^Blackridge/)).toBe(true);
    await click(card(/^Light$/));
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
