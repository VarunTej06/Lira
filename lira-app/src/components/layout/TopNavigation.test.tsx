import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, mount, q } from '../../test/render';
import { TopNavigation } from './TopNavigation';

vi.mock('../../services/localDiskSync', () => ({
  subscribeToSyncStatus: (cb: (s: { status: string; lastSaved: Date | null; filePath: string }) => void) => { cb({ status: 'synced', lastSaved: null, filePath: 'data/x.json' }); return () => {}; },
  saveToDiskNow: vi.fn(),
}));

afterEach(cleanup);

describe('Top bar layout', () => {
  it('has no app switcher', () => {
    mount(<MemoryRouter><TopNavigation /></MemoryRouter>);
    expect(q('button[aria-label="Switch sites or apps"]')).toBeNull();
  });

  it('puts the logo on the page frame, outside the dark box', () => {
    mount(<MemoryRouter><TopNavigation /></MemoryRouter>);
    const logo = q('svg[aria-label="Liraspaces"]')!;
    const box = q('nav > div:nth-child(2)')!;
    expect(box.className).toContain('bg-lira-nav');
    expect(box.contains(logo)).toBe(false);
  });

  it('keeps Create and search inside the box, and the utilities outside it, each in a circle', () => {
    mount(<MemoryRouter><TopNavigation /></MemoryRouter>);
    const box = q('nav > div:nth-child(2)')!;
    expect(box.textContent).toContain('Create');
    expect(box.querySelector('input')).not.toBeNull();
    const gear = q<HTMLButtonElement>('button[title="Settings & Administration"]')!;
    const bell = q<HTMLButtonElement>('button[title="Notifications Center"]')!;
    const account = q<HTMLButtonElement>('button[title="Your account"]')!;
    for (const b of [gear, bell, account]) {
      expect(box.contains(b)).toBe(false);
      expect(b.className).toContain('rounded-full');
    }
  });

  it('shows the save state without a circle', () => {
    mount(<MemoryRouter><TopNavigation /></MemoryRouter>);
    const save = q<HTMLButtonElement>('button[title^="Saved locally"]')!;
    expect(save.textContent).toContain('PC Saved');
    expect(save.className).not.toContain('rounded-full');
  });
});
