import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q } from '../../../test/render';
import { SystemSettingsModal } from './SystemSettingsModal';
import { getLightPalette, getTheme } from '../../../utils/theme';

const root = document.documentElement;

beforeEach(() => { localStorage.clear(); root.classList.remove('dark'); delete root.dataset.palette; });
afterEach(cleanup);

const open = () => mount(<SystemSettingsModal isOpen onClose={vi.fn()} importing={false} importStatus={null} onExport={vi.fn()} onImportClick={vi.fn()} />);
const pill = (label: string) => byText<HTMLButtonElement>('button[aria-pressed]', label)!;
const save = () => byText<HTMLButtonElement>('button', 'Save')!;
const palettes = () => q('[aria-label="Light palette"]');

describe('System settings: theme', () => {
  it('opens on the saved theme and asks for a light palette only when Light is chosen', async () => {
    open();
    expect(pill('Dark').getAttribute('aria-pressed')).toBe('true');
    expect(palettes()).toBeNull();
    await click(pill('Light'));
    expect(palettes()).not.toBeNull();
    expect(pill('Sorrel').getAttribute('aria-pressed')).toBe('true');
  });

  it('applies nothing until Save, then saves the theme with the chosen palette', async () => {
    open();
    await click(pill('Light'));
    await click(pill('Fawn'));
    expect(getTheme()).toBe('dark');
    await click(save());
    expect(getTheme()).toBe('light');
    expect(getLightPalette()).toBe('fawn');
    expect(root.dataset.palette).toBe('fawn');
  });

  it('treats a different palette in light mode as a change to save', async () => {
    localStorage.setItem('lira_theme', 'light');
    open();
    expect(save().disabled).toBe(true);
    await click(pill('Fawn'));
    expect(save().disabled).toBe(false);
  });
});
