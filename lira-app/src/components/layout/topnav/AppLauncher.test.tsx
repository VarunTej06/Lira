import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, qa } from '../../../test/render';
import { APP_VERSION } from '../../../utils/appVersion';
import { AppLauncher } from './AppLauncher';

afterEach(cleanup);

const trigger = () => q<HTMLButtonElement>('button[aria-label="Switch sites or apps"]')!;

function open() {
  const h = { onToggleAI: vi.fn(), onOpenBackup: vi.fn(), onNavigateToProjects: vi.fn() };
  mount(<AppLauncher {...h} />);
  return h;
}

describe('App switcher', () => {
  it('is closed until its button is pressed', async () => {
    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(byText('button', 'Projects')).toBeUndefined();
    await click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the version of the app and its five destinations', async () => {
    open();
    await click(trigger());
    expect(document.body.textContent).toContain(`v${APP_VERSION}`);
    const labels = qa('button').map(b => b.textContent?.trim()).filter(Boolean);
    expect(labels).toEqual(['Lira Board', 'Projects', 'Viva AI Assistant', 'Backup & Restore', 'GitHub Repo']);
  });

  it('runs the chosen destination and closes', async () => {
    const h = open();
    await click(trigger());
    await click(byText('button', 'Projects'));
    expect(h.onNavigateToProjects).toHaveBeenCalledOnce();
    expect(byText('button', 'Projects')).toBeUndefined();

    await click(trigger());
    await click(byText('button', 'Viva AI Assistant'));
    expect(h.onToggleAI).toHaveBeenCalledOnce();

    await click(trigger());
    await click(byText('button', 'Backup & Restore'));
    expect(h.onOpenBackup).toHaveBeenCalledOnce();
  });

  it('closes on Escape', async () => {
    open();
    await click(trigger());
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(byText('button', 'Projects')).toBeUndefined();
  });
});
