import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { StandupsPage } from './StandupsPage';

const access = vi.hoisted(() => ({ myAccess: vi.fn() }));
vi.mock('../../services/accessApi', () => access);
const api = vi.hoisted(() => ({
  listStandups: vi.fn(), standupAudience: vi.fn(), createStandup: vi.fn(), updateStandup: vi.fn(), deleteStandup: vi.fn(),
  googleStatus: vi.fn(), startGoogleConnect: vi.fn(), disconnectGoogle: vi.fn(),
}));
vi.mock('../../services/standupsApi', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/standupsApi')>()), ...api }));
vi.mock('../common/dialogStore', () => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../../utils/clock', () => ({ currentTimeMs: () => new Date('2026-11-25T05:00:00Z').getTime() })); // a Wednesday, after the day's call

vi.mock('../common/DatePicker', () => ({
  // The real picker is a pop-up calendar with its own tests; here a plain field stands in so the form's own logic can be tested
  DatePicker: ({ value, onChange, 'aria-label': label }: { value: string; onChange: (v: string) => void; 'aria-label'?: string }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const series = {
  id: 's1', title: 'Daily', startsAt: '2026-11-23T04:30:00Z', durationMinutes: 15, link: 'https://meet.google.com/abc-defg-hij', linkSource: 'meet' as const,
  repeat: 'weekdays' as const, repeatUntil: '2026-12-04', timeZone: 'Asia/Kolkata', invitees: [{ type: 'team' as const, id: 't1' }],
};
const finished = { ...series, id: 's2', title: 'Sprint week', repeat: 'daily' as const, repeatUntil: '2026-11-24', startsAt: '2026-11-23T04:30:00Z' };
const audience = (canMakeMeetLink: boolean) => ({ people: [{ id: 'u1', name: 'Asha', email: 'a@x.co' }], teams: [{ id: 't1', name: 'Dev' }], canMakeMeetLink });

beforeEach(() => {
  Object.values({ ...access, ...api }).forEach(f => f.mockReset());
  setActiveOrg('org-1');
  access.myAccess.mockResolvedValue(ok({ role: 'owner', canManageAccess: true }));
  api.listStandups.mockResolvedValue(ok([series, finished]));
  api.standupAudience.mockResolvedValue(ok(audience(true)));
  api.googleStatus.mockResolvedValue(ok({ configured: true, connected: true, email: 'owner@gmail.com' }));
});
afterEach(() => { cleanup(); setActiveOrg(null); });

const open = async (search = '') => { mount(<MemoryRouter initialEntries={[`/standups${search}`]}><StandupsPage /></MemoryRouter>); await settle(40); };
const typeInto = async (el: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const pick = async (el: HTMLSelectElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })); });
};

describe('a stand-up that repeats', () => {
  it('shows how it repeats and the next call, keeps a finished series under Earlier with its last call, and lists the series once', async () => {
    await open();
    const upcoming = q('section[aria-label="Upcoming"]')!.textContent!;
    expect(upcoming).toContain('Every weekday until 4 Dec 2026');
    expect(upcoming).toContain('Next:');
    expect(upcoming).toContain('Thu'); // the next weekday after the call that already happened today is Thursday 26 November
    expect(qa('section[aria-label="Upcoming"] li')).toHaveLength(1);
    const earlier = q('section[aria-label="Earlier"]')!.textContent!;
    expect(earlier).toContain('Sprint week');
    expect(earlier).toContain('Last:');
  });
});

describe('Google on the stand-ups page', () => {
  it('shows the owner who is connected, and a way to disconnect', async () => {
    api.disconnectGoogle.mockResolvedValue(ok(undefined));
    await open();
    expect(q('section[aria-label="Google"]')!.textContent).toContain('owner@gmail.com');
    await click(byText('button', 'Disconnect Google'));
    expect(api.disconnectGoogle).toHaveBeenCalledWith('org-1');
  });

  it('offers the owner to connect, and sends them to Google\'s own sign-in page', async () => {
    api.googleStatus.mockResolvedValue(ok({ configured: true, connected: false, email: null }));
    api.startGoogleConnect.mockResolvedValue(ok({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    await open();
    await click(byText('button', 'Connect Google'));
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    vi.unstubAllGlobals();
  });

  it('says Google is not set up on the server, and shows nothing about it to an Admin or a member', async () => {
    api.googleStatus.mockResolvedValue(ok({ configured: false, connected: false, email: null }));
    await open();
    expect(q('[aria-label="Loading stand-ups"]')).toBeNull();
    expect(document.body.textContent).toContain('Google is not set up on this server yet');
    cleanup();
    access.myAccess.mockResolvedValue(ok({ role: 'admin', canManageAccess: true }));
    await open();
    expect(q('section[aria-label="Google"]')).toBeNull();
    expect(byText('button', 'Connect Google')).toBeUndefined();
  });

  it('tells the owner how the sign-in went when Google sends them back', async () => {
    await open('?google=connected');
    expect(q('[role="status"]')!.textContent).toContain('Google is connected.');
    cleanup();
    await open('?google=refused');
    expect(q('[role="status"]')!.textContent).toContain('cancelled');
    cleanup();
    await open('?google=failed');
    expect(q('[role="status"]')!.textContent).toContain('could not be connected');
  });
});

describe('scheduling with repeats and a Meet link made for you', () => {
  const fill = async () => {
    await click(byText('button', 'Schedule a call'));
    await typeInto(q<HTMLInputElement>('input[aria-label="First day"]')!, '2026-12-01');
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
  };

  it('needs no link when Google can make it, and says so; the call is sent without one', async () => {
    api.createStandup.mockResolvedValue(ok({ ...series, emailed: { sent: 2, total: 2 } }));
    await open();
    await fill();
    expect(q('form')!.textContent).toContain('leave empty to make a Google Meet link');
    expect(q<HTMLInputElement>('form input[type="url"]')!.required).toBe(false);
    await click(byText('button', 'Schedule'));
    await settle(30);
    const input = api.createStandup.mock.calls[0][1];
    expect(input).not.toHaveProperty('link');
    expect(input).toMatchObject({ repeat: 'none', timeZone: expect.any(String) });
    expect(input).not.toHaveProperty('repeatUntil');
    expect(q('[role="status"]')!.textContent).toContain('2 invitation emails sent');
  });

  it('needs a pasted link, and says why, when Google is not connected', async () => {
    api.standupAudience.mockResolvedValue(ok(audience(false)));
    await open();
    await fill();
    expect(q<HTMLInputElement>('form input[type="url"]')!.required).toBe(true);
    expect(q('form')!.textContent).toContain('Google is not connected, so paste a link');
  });

  it('turns "every weekday for 1 month" into a last day, counting from the first call', async () => {
    api.createStandup.mockResolvedValue(ok({ ...series, emailed: { sent: 0, total: 0 } }));
    await open();
    await fill();
    await pick(q<HTMLSelectElement>('select[aria-label="Repeats"]')!, 'weekdays');
    await pick(q<HTMLSelectElement>('select[aria-label="For how long"]')!, 'month');
    await click(byText('button', 'Schedule'));
    await settle(30);
    expect(api.createStandup.mock.calls[0][1]).toMatchObject({ repeat: 'weekdays', repeatUntil: '2026-12-31' });
  });

  it('offers a week, two weeks, a month, a number of days and a chosen day, and uses each', async () => {
    api.createStandup.mockResolvedValue(ok({ ...series, emailed: { sent: 0, total: 0 } }));
    await open();
    await fill();
    await pick(q<HTMLSelectElement>('select[aria-label="Repeats"]')!, 'daily');
    expect([...q<HTMLSelectElement>('select[aria-label="For how long"]')!.options].map(o => o.textContent)).toEqual(['For 1 week', 'For 2 weeks', 'For 1 month', 'For a number of days', 'Until a day I choose']);
    await pick(q<HTMLSelectElement>('select[aria-label="For how long"]')!, 'days');
    await typeInto(q<HTMLInputElement>('input[aria-label="Number of days"]')!, '10');
    await click(byText('button', 'Schedule'));
    await settle(30);
    expect(api.createStandup.mock.calls[0][1]).toMatchObject({ repeat: 'daily', repeatUntil: '2026-12-10' });
    await click(byText('button', 'Schedule a call'));
    await typeInto(q<HTMLInputElement>('input[aria-label="First day"]')!, '2026-12-01');
    await click(qa<HTMLInputElement>('form fieldset input')[0]);
    await pick(q<HTMLSelectElement>('select[aria-label="Repeats"]')!, 'weekly');
    await pick(q<HTMLSelectElement>('select[aria-label="For how long"]')!, 'date');
    await click(byText('button', 'Schedule'));
    expect(q('form [role="alert"]')!.textContent).toContain('Choose the day the repeat ends');
    await typeInto(q<HTMLInputElement>('input[aria-label="Last day"]')!, '2027-02-01');
    await click(byText('button', 'Schedule'));
    await settle(30);
    expect(api.createStandup.mock.calls[1][1]).toMatchObject({ repeat: 'weekly', repeatUntil: '2027-02-01' });
  });

  it('shows no end choices for a call that does not repeat', async () => {
    await open();
    await click(byText('button', 'Schedule a call'));
    expect(q('select[aria-label="For how long"]')).toBeNull();
    await pick(q<HTMLSelectElement>('select[aria-label="Repeats"]')!, 'daily');
    expect(q('select[aria-label="For how long"]')).not.toBeNull();
    await pick(q<HTMLSelectElement>('select[aria-label="Repeats"]')!, 'none');
    expect(q('select[aria-label="For how long"]')).toBeNull();
  });

  it('opens an existing series with its rule and last day, and keeps its time zone when changed', async () => {
    api.updateStandup.mockResolvedValue(ok(series));
    await open();
    await click(qa('section[aria-label="Upcoming"] button').find(b => b.textContent === 'Change')!);
    expect(q<HTMLSelectElement>('select[aria-label="Repeats"]')!.value).toBe('weekdays');
    expect(q<HTMLSelectElement>('select[aria-label="For how long"]')!.value).toBe('date');
    expect(q<HTMLInputElement>('input[aria-label="Last day"]')!.value).toBe('2026-12-04');
    await click(byText('button', 'Save changes'));
    await settle(30);
    expect(api.updateStandup).toHaveBeenCalledWith('org-1', 's1', expect.objectContaining({ timeZone: 'Asia/Kolkata', repeat: 'weekdays', repeatUntil: '2026-12-04' }));
  });
});
