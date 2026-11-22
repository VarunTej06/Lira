import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, qa } from '../../../test/render';
import { SystemSettingsModal } from './SystemSettingsModal';
import { getPalette, getTheme } from '../../../utils/theme';

const root = document.documentElement;

beforeEach(() => { localStorage.clear(); root.classList.remove('dark'); delete root.dataset.palette; });
afterEach(cleanup);

const open = () => mount(<SystemSettingsModal isOpen onClose={vi.fn()} importing={false} importStatus={null} onExport={vi.fn()} onImportClick={vi.fn()} />);
const pill = (label: string) => byText<HTMLButtonElement>('button[aria-pressed]', label)!;
const save = () => byText<HTMLButtonElement>('button', 'Save')!;
const palettes = () => qa('[aria-label="Palette"] button').map(b => b.textContent?.trim());

describe('System settings: theme', () => {
  it('opens on the saved theme with the palettes of that theme, and swaps them when the theme is switched', async () => {
    open();
    expect(pill('Dark').getAttribute('aria-pressed')).toBe('true');
    expect(palettes()).toEqual(['Pace', 'Blackridge']);
    expect(pill('Pace').getAttribute('aria-pressed')).toBe('true');
    await click(pill('Light'));
    expect(palettes()).toEqual(['Sorrel', 'Fawn', 'Mossgrove', 'Tidewell']);
    expect(pill('Sorrel').getAttribute('aria-pressed')).toBe('true');
  });

  it('applies nothing until Save, then saves the theme with the chosen palette', async () => {
    open();
    await click(pill('Light'));
    await click(pill('Mossgrove'));
    expect(getTheme()).toBe('dark');
    await click(save());
    expect(getTheme()).toBe('light');
    expect(getPalette('light')).toBe('mossgrove');
    expect(root.dataset.palette).toBe('mossgrove');
  });

  it('treats a different palette of the same theme as a change to save, in dark and in light', async () => {
    open();
    expect(save().disabled).toBe(true);
    await click(pill('Blackridge'));
    expect(save().disabled).toBe(false);
    await click(save());
    expect(getPalette('dark')).toBe('blackridge');
    expect(root.dataset.palette).toBe('blackridge');
    cleanup();
    localStorage.setItem('lira_theme', 'light');
    open();
    expect(save().disabled).toBe(true);
    await click(pill('Fawn'));
    expect(save().disabled).toBe(false);
  });
});
