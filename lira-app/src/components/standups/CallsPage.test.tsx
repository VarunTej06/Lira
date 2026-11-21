import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { StandupsPage } from './StandupsPage';

const access = vi.hoisted(() => ({ myAccess: vi.fn() }));
vi.mock('../../services/accessApi', () => access);
const api = vi.hoisted(() => ({ listStandups: vi.fn(), standupAudience: vi.fn(), createStandup: vi.fn(), googleStatus: vi.fn() }));
vi.mock('../../services/standupsApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/standupsApi')>()), ...api }));
vi.mock('../common/DatePicker', () => ({
  DatePicker: ({ value, onChange, 'aria-label': label }: { value: string; onChange: (v: string) => void; 'aria-label'?: string }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}));
vi.mock('../common/dialogStore', () => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../../utils/clock', () => ({ currentTimeMs: () => new Date('2026-11-23T00:00:00Z').getTime() }));
vi.mock('./useCallScopeChoices', () => ({
  useCallScopeChoices: () => [
    { type: 'org', id: '', name: 'Whole organisation (stand-up)' }, { type: 'space', id: 'space:1', name: 'Lira' },
    { type: 'project', id: 'project:proj-a', name: 'Alpha' }, { type: 'sprint', id: 'sprint:2026-11:all', name: 'November 2026 Sprint' },
  ],
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const base = { repeat: 'none' as const, repeatUntil: null, timeZone: 'UTC', linkSource: 'pasted' as const, invitees: [], startsAt: '2026-11-24T10:00:00Z', durationMinutes: 15, link: 'https://meet.google.com/abc' };
const calls = [
  { ...base, id: '1', title: 'Daily', scopeType: 'org' as const, scopeId: '', scopeName: '' },
  { ...base, id: '2', title: 'Weekly sync', scopeType: 'project' as const, scopeId: 'project:proj-a', scopeName: 'Alpha' },
  { ...base, id: '3', title: 'Review', scopeType: 'sprint' as const, scopeId: 'sprint:2026-11:all', scopeName: 'November 2026 Sprint' },
];

beforeEach(() => {
  Object.values({ ...access, ...api }).forEach(f => f.mockReset());
  setActiveOrg('org-1');
  access.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listStandups.mockResolvedValue(ok(calls));
  api.standupAudience.mockResolvedValue(ok({ people: [{ id: 'u1', name: 'Asha', email: 'a@x.co' }], teams: [], canMakeMeetLink: true }));
  api.googleStatus.mockResolvedValue(ok({ configured: true, connected: true, email: 'o@gmail.com' }));
});
afterEach(() => { cleanup(); setActiveOrg(null); });

const open = async () => { mount(<MemoryRouter><StandupsPage /></MemoryRouter>); await settle(40); };
const upcoming = () => q('section[aria-label="Upcoming"]')!.textContent!;

describe('the Manage calls page', () => {
  it('lists every kind of call together, each labelled with what it is for', async () => {
    await open();
    expect(q('h1')!.textContent).toBe('Calls');
    expect(upcoming()).toContain('Stand-up');
    expect(upcoming()).toContain('Project sync: Alpha');
    expect(upcoming()).toContain('Sprint call: November 2026 Sprint');
  });

  it('filters by kind of call and back to all', async () => {
    await open();
    await click(byText('button', 'Project syncs'));
    expect(upcoming()).toContain('Weekly sync');
    expect(upcoming()).not.toContain('Review');
    expect(upcoming()).not.toContain('Daily');
    await click(byText('button', 'Stand-ups'));
    expect(upcoming()).toContain('Daily');
    expect(upcoming()).not.toContain('Weekly sync');
    await click(byText('button', 'All calls'));
    expect(qa('section[aria-label="Upcoming"] li')).toHaveLength(3);
    expect(byText('button', 'Project syncs')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('lets an Owner or Admin pick what a new call is for, from the organisation, spaces, projects and sprints', async () => {
    api.createStandup.mockResolvedValue(ok({ ...calls[1], emailed: { sent: 0, total: 0 } }));
    await open();
    await click(byText('button', 'Schedule a call'));
    const select = q<HTMLSelectElement>('select[aria-label="What is this call for"]')!;
    expect([...select.options].map(o => o.textContent)).toEqual(['Whole organisation (stand-up)', 'Space call: Lira', 'Project sync: Alpha', 'Sprint call: November 2026 Sprint']);
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, 'project:project:proj-a'); select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { const d = q<HTMLInputElement>('input[aria-label="First day"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(d, '2026-12-01'); d.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
    await click(byText('button', 'Schedule'));
    await settle(30);
    expect(api.createStandup.mock.calls[0][1]).toMatchObject({ scopeType: 'project', scopeId: 'project:proj-a', scopeName: 'Alpha' });
  });

  it('sends no scope id for a stand-up for the whole organisation', async () => {
    api.createStandup.mockResolvedValue(ok({ ...calls[0], emailed: { sent: 0, total: 0 } }));
    await open();
    await click(byText('button', 'Schedule a call'));
    await act(async () => { const d = q<HTMLInputElement>('input[aria-label="First day"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(d, '2026-12-01'); d.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
    await click(byText('button', 'Schedule'));
    await settle(30);
    const input = api.createStandup.mock.calls[0][1];
    expect(input).toMatchObject({ scopeType: 'org' });
    expect(input.scopeId).toBeUndefined();
  });

  it('shows a member the calls they are invited to, with the kind filters, and nothing to schedule', async () => {
    access.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    await open();
    expect(byText('button', 'Project syncs')).toBeDefined();
    expect(byText('button', 'Schedule a call')).toBeUndefined();
  });
});
