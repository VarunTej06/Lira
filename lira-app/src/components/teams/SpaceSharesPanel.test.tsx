import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa, settle } from '../../test/render';
import { SpaceSharesPanel } from './SpaceSharesPanel';

const api = vi.hoisted(() => ({ listSpaceShares: vi.fn(), setSpaceShares: vi.fn() }));
vi.mock('../../services/accessApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/accessApi')>()), ...api }));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const row = { userId: 'u1', name: 'Asha', email: 'asha@x.co', projects: true, roadmaps: true, dashboards: true, sprints: true };

beforeEach(() => { api.listSpaceShares.mockReset(); api.setSpaceShares.mockReset(); });
afterEach(cleanup);

const box = (label: string) => q<HTMLInputElement>(`input[aria-label="${label}"]`)!;

describe('what invited people see of a space', () => {
  it('shows nothing when nobody was invited to the space, or the list cannot be read', async () => {
    api.listSpaceShares.mockResolvedValue(ok([]));
    mount(<SpaceSharesPanel org="o" spaceId="4" />);
    await settle(30);
    expect(q('section')).toBeNull();
    cleanup();
    api.listSpaceShares.mockResolvedValue({ ok: false, status: 500, message: 'x' });
    mount(<SpaceSharesPanel org="o" spaceId="4" />);
    await settle(30);
    expect(q('section')).toBeNull();
  });

  it('lists each person with the four switches, on as the server says', async () => {
    api.listSpaceShares.mockResolvedValue(ok([{ ...row, sprints: false }]));
    mount(<SpaceSharesPanel org="o" spaceId="4" />);
    await settle(30);
    expect(api.listSpaceShares).toHaveBeenCalledWith('o', '4');
    expect(qa('input[type="checkbox"]')).toHaveLength(4);
    expect(box('Projects for Asha').checked).toBe(true);
    expect(box('Sprints for Asha').checked).toBe(false);
  });

  it('sends only the switch that changed, and shows it changed', async () => {
    api.listSpaceShares.mockResolvedValue(ok([row]));
    api.setSpaceShares.mockResolvedValue(ok(undefined));
    mount(<SpaceSharesPanel org="o" spaceId="4" />);
    await settle(30);
    await act(async () => { box('Roadmaps for Asha').click(); });
    await settle(20);
    expect(api.setSpaceShares).toHaveBeenCalledWith('o', '4', 'u1', { roadmaps: false });
    expect(box('Roadmaps for Asha').checked).toBe(false);
    expect(box('Projects for Asha').checked).toBe(true);
  });

  it('keeps the switch as it was and says why when the server refuses', async () => {
    api.listSpaceShares.mockResolvedValue(ok([row]));
    api.setSpaceShares.mockResolvedValue({ ok: false, status: 403, message: 'You do not have access to this.' });
    mount(<SpaceSharesPanel org="o" spaceId="4" />);
    await settle(30);
    await act(async () => { box('Projects for Asha').click(); });
    await settle(20);
    expect(q('[role="alert"]')!.textContent).toContain('You do not have access');
    expect(box('Projects for Asha').checked).toBe(true);
  });
});
