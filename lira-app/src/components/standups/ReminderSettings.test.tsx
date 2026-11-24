import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa, settle } from '../../test/render';
import { ReminderSettings } from './ReminderSettings';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const serve = (get: unknown, put: () => Response = () => json(200, { calls: false, due: true, available: true })) =>
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => (init?.method === 'PUT' ? put() : json(200, get)));
const box = (n: number) => qa<HTMLInputElement>('input[type="checkbox"]')[n];

beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('reminder switches', () => {
  it('shows nothing until the server answers, and nothing when it cannot', async () => {
    fetchMock.mockResolvedValue(json(500, {}));
    mount(<ReminderSettings />);
    await settle(30);
    expect(q('section')).toBeNull();
  });

  it('shows both switches as the server has them, and sends only the one that changed', async () => {
    serve({ calls: true, due: true, available: true });
    mount(<ReminderSettings />);
    await settle(30);
    expect([box(0).checked, box(1).checked]).toEqual([true, true]);
    await act(async () => { box(0).click(); });
    await settle(20);
    const put = fetchMock.mock.calls.find(c => (c[1] as RequestInit).method === 'PUT')!;
    expect(put[0]).toBe('/api/me/reminders');
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ calls: false });
    expect(box(0).checked).toBe(false);
    expect(box(1).checked).toBe(true);
  });

  it('says so, and switches nothing, when the server has no email service', async () => {
    serve({ calls: true, due: true, available: false });
    mount(<ReminderSettings />);
    await settle(30);
    expect(q('section')!.textContent).toContain('Email is not set up');
    expect(box(0).disabled && box(1).disabled).toBe(true);
  });

  it('keeps the switch as it was and shows the reason when the change is refused', async () => {
    serve({ calls: true, due: true, available: true }, () => json(500, { error: { message: 'Something went wrong. Try again in a moment.' } }));
    mount(<ReminderSettings />);
    await settle(30);
    await act(async () => { box(1).click(); });
    await settle(20);
    expect(q('[role="alert"]')!.textContent).toContain('Something went wrong');
    expect(box(1).checked).toBe(true);
  });
});
