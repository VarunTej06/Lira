import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { scheduledNote, splitLocal } from './standupTime';
import { StandupsPage } from './StandupsPage';

const access = vi.hoisted(() => ({ myAccess: vi.fn() }));
vi.mock('../../services/accessApi', () => access);
const api = vi.hoisted(() => ({
  listStandups: vi.fn(), standupAudience: vi.fn(), createStandup: vi.fn(), updateStandup: vi.fn(), deleteStandup: vi.fn(),
  googleStatus: vi.fn(), startGoogleConnect: vi.fn(), disconnectGoogle: vi.fn(),
}));
vi.mock('../../services/standupsApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/standupsApi')>()), ...api }));
const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
vi.mock('../../utils/clock', () => ({ currentTimeMs: () => new Date('2026-11-23T00:00:00Z').getTime() }));

vi.mock('../common/DatePicker', () => ({
  // The real picker is a pop-up calendar with its own tests; here a plain field stands in so the form's own logic can be tested
  DatePicker: ({ value, onChange, 'aria-label': label }: { value: string; onChange: (v: string) => void; 'aria-label'?: string }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const once = { repeat: 'none' as const, repeatUntil: null, timeZone: 'Asia/Kolkata', linkSource: 'pasted' as const };
const future = { ...once, id: 's1', title: 'Daily', startsAt: '2026-11-24T04:30:00Z', durationMinutes: 15, link: 'https://meet.google.com/abc-defg-hij', invitees: [{ type: 'team' as const, id: 't1' }] };
const earlier = { ...once, id: 's0', title: 'Last week', startsAt: '2026-11-16T04:30:00Z', durationMinutes: 15, link: 'https://teams.microsoft.com/l/meetup-join/x', invitees: [] };
const audience = { people: [{ id: 'u1', name: 'Asha', email: 'a@x.co' }], teams: [{ id: 't1', name: 'Dev' }], canMakeMeetLink: false };

beforeEach(() => {
  Object.values({ ...access, ...api, ...dialog }).forEach(f => f.mockClear());
  setActiveOrg('org-1');
  access.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listStandups.mockResolvedValue(ok([earlier, future]));
  api.standupAudience.mockResolvedValue(ok(audience));
  api.deleteStandup.mockResolvedValue(ok(undefined));
  api.googleStatus.mockResolvedValue(ok({ configured: true, connected: false, email: null }));
});
afterEach(() => { cleanup(); setActiveOrg(null); });

const open = async (search = '') => { mount(<MemoryRouter initialEntries={[`/standups${search}`]}><StandupsPage /></MemoryRouter>); await settle(40); };
const typeInto = async (el: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('time helpers', () => {
  it('gives the day and the time of a moment in local time, and a sensible note about invitation emails', () => {
    expect(splitLocal('2026-11-24T04:30:00Z').day).toMatch(/^2026-11-2[34]$/);
    expect(splitLocal('2026-11-24T04:30:00Z').time).toMatch(/^[0-9][0-9]:[0-9][0-9]$/);
    expect(scheduledNote({ sent: 0, total: 0 })).toBe('Stand-up scheduled.');
    expect(scheduledNote({ sent: 3, total: 3 })).toContain('3 invitation emails sent');
    expect(scheduledNote({ sent: 1, total: 1 })).toContain('1 invitation email sent');
    expect(scheduledNote({ sent: 0, total: 2 })).toContain('Email is not connected');
  });
});

describe('stand-up calls page', () => {
  it('shows a loading state, then upcoming and earlier calls with a join link that opens safely', async () => {
    access.myAccess.mockReturnValue(new Promise(() => undefined));
    mount(<MemoryRouter><StandupsPage /></MemoryRouter>);
    expect(q('[aria-label="Loading stand-ups"]')).not.toBeNull();
    cleanup();
    access.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
    await open();
    expect(q('section[aria-label="Upcoming"]')!.textContent).toContain('Daily');
    expect(q('section[aria-label="Earlier"]')!.textContent).toContain('Last week');
    const join = q<HTMLAnchorElement>('section[aria-label="Upcoming"] a')!;
    expect(join.getAttribute('href')).toBe(future.link);
    expect(join.getAttribute('target')).toBe('_blank');
    expect(join.getAttribute('rel')).toContain('noopener');
  });

  it('shows a member only the calls and a join link: no guest list, no schedule button, no change or delete', async () => {
    access.myAccess.mockResolvedValue(ok({ role: 'member', canManageAccess: false }));
    api.listStandups.mockResolvedValue(ok([{ ...future, invitees: null }]));
    await open();
    expect(q('section[aria-label="Upcoming"] a')).not.toBeNull();
    expect(byText('button', 'Schedule a call')).toBeUndefined();
    expect(byText('button', 'Change')).toBeUndefined();
    expect(byText('button', 'Delete')).toBeUndefined();
    expect(q('section[aria-label="Upcoming"]')!.textContent).not.toContain('Invited');
    expect(api.standupAudience).not.toHaveBeenCalled();
  });

  it('never makes a link of an address that is not a meeting', async () => {
    api.listStandups.mockResolvedValue(ok([{ ...future, link: 'https://evil.example/x' }, { ...future, id: 's2', link: 'javascript:alert(1)' }]));
    await open();
    expect(qa('a')).toHaveLength(0);
  });

  it('says there is nothing when there is nothing, and shows an error with a way to try again', async () => {
    api.listStandups.mockResolvedValueOnce({ ok: false, status: 0, message: 'Could not reach the server.' });
    await open();
    expect(q('[role="alert"]')!.textContent).toContain('Could not reach the server.');
    api.listStandups.mockResolvedValue(ok([]));
    await click(byText('button', 'Try again'));
    await settle(40);
    expect(q('section[aria-label="Upcoming"]')!.textContent).toContain('No calls are scheduled for you.');
  });

  it('shows the owner who is invited, and lets them delete a call after asking', async () => {
    await open();
    expect(q('section[aria-label="Upcoming"]')!.textContent).toContain('Invited: Team Dev');
    api.listStandups.mockResolvedValue(ok([earlier]));
    await click(qa('section[aria-label="Upcoming"] button').find(b => b.textContent === 'Delete')!);
    expect(dialog.confirmDialog).toHaveBeenCalled();
    expect(api.deleteStandup).toHaveBeenCalledWith('org-1', 's1');
  });

  it('schedules a call for chosen people and teams with a pasted link, and tells the owner how invitations went', async () => {
    api.createStandup.mockResolvedValue(ok({ ...future, emailed: { sent: 0, total: 1 } }));
    await open();
    await click(byText('button', 'Schedule a call'));
    await typeInto(q<HTMLInputElement>('input[aria-label="First day"]')!, '2026-11-25');
    await typeInto(q<HTMLInputElement>('form input[type="url"]')!, 'https://meet.google.com/abc-defg-hij');
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
    await click(byText('button', 'Schedule'));
    await settle(30);
    const [org, input] = api.createStandup.mock.calls[0];
    expect(org).toBe('org-1');
    expect(input).toMatchObject({ title: 'Daily stand-up', durationMinutes: 15, link: 'https://meet.google.com/abc-defg-hij', invitees: [{ type: 'team', id: 't1' }] });
    expect(new Date(input.startsAt).getTime()).toBe(new Date('2026-11-25T10:00').getTime());
    expect(q('[role="status"]')!.textContent).toContain('Email is not connected');
  });

  it('refuses a link that is not a meeting before sending, and needs someone to invite', async () => {
    await open();
    await click(byText('button', 'Schedule a call'));
    await typeInto(q<HTMLInputElement>('form input[type="url"]')!, 'https://evil.example/x');
    expect(q('form [role="alert"]')!.textContent).toContain('Google Meet or Microsoft Teams');
    expect((byText('button', 'Schedule') as HTMLButtonElement).disabled).toBe(true);
    await typeInto(q<HTMLInputElement>('form input[type="url"]')!, 'https://meet.google.com/abc');
    await typeInto(q<HTMLInputElement>('input[aria-label="First day"]')!, '2026-11-25');
    await click(byText('button', 'Schedule'));
    expect(q('form [role="alert"]')!.textContent).toContain('Invite at least one');
    expect(api.createStandup).not.toHaveBeenCalled();
  });

  it('shows why the server refused, and changes an existing call with the guests already ticked', async () => {
    api.updateStandup.mockResolvedValue({ ok: false, status: 400, message: 'x', fields: { link: 'Use a Google Meet or Microsoft Teams link, starting with https://.' } });
    await open();
    await click(qa('section[aria-label="Upcoming"] button').find(b => b.textContent === 'Change')!);
    expect(qa<HTMLInputElement>('form fieldset input').filter(i => i.checked)).toHaveLength(1);
    await click(byText('button', 'Save changes'));
    await settle(30);
    expect(api.updateStandup).toHaveBeenCalledWith('org-1', 's1', expect.objectContaining({ title: 'Daily', invitees: [{ type: 'team', id: 't1' }] }));
    expect(q('form [role="alert"]')!.textContent).toContain('Google Meet');
  });
});
