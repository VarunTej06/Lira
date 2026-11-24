import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_NAMES, DEFAULT_SCHEDULE, dashboardJsonName, downloadText, lastScheduledMoment, listSnapshotFiles, nextScheduledMoment, saveSnapshotFile, snapshotDue, snapshotFileName } from './snapshot';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const monday9 = { enabled: true, day: 1, hour: 9 };

describe('the weekly schedule', () => {
  it('names the days from Sunday and starts switched off, on Monday at nine', () => {
    expect(DAY_NAMES[0]).toBe('Sunday');
    expect(DAY_NAMES).toHaveLength(7);
    expect(DEFAULT_SCHEDULE).toEqual({ enabled: false, day: 1, hour: 9 });
  });
  it('counts a moment later the same day as not yet come, so the last one is a week before', () => {
    expect(lastScheduledMoment(monday9, new Date(2026, 10, 9, 8))).toEqual(new Date(2026, 10, 2, 9));
    expect(lastScheduledMoment(monday9, new Date(2026, 10, 9, 9))).toEqual(new Date(2026, 10, 9, 9));
    expect(nextScheduledMoment(monday9, new Date(2026, 10, 12))).toEqual(new Date(2026, 10, 16, 9));
  });
  it('is never due when switched off or missing', () => {
    expect(snapshotDue(undefined, new Date())).toBe(false);
    expect(snapshotDue({ ...monday9, enabled: false }, new Date())).toBe(false);
  });
  it('is due until a run after the last moment is recorded', () => {
    const now = new Date(2026, 10, 12);
    expect(snapshotDue(monday9, now)).toBe(true);
    expect(snapshotDue({ ...monday9, lastRun: new Date(2026, 10, 9, 9, 5).toISOString() }, now)).toBe(false);
    expect(snapshotDue({ ...monday9, lastRun: new Date(2026, 10, 8).toISOString() }, now)).toBe(true);
  });
});

describe('file names', () => {
  it('makes a short readable name with the date', () => {
    expect(snapshotFileName({ id: 'd', name: 'Sprint Health!' }, new Date(2026, 0, 5))).toBe('sprint-health-2026-01-05.md');
    expect(snapshotFileName({ id: 'd', name: '!!!' }, new Date(2026, 0, 5))).toBe('dashboard-2026-01-05.md');
    expect(snapshotFileName({ id: 'd', name: 'x'.repeat(100) }, new Date(2026, 0, 5)).length).toBe(40 + '-2026-01-05.md'.length);
  });
  it('names the export of a dashboard', () => {
    expect(dashboardJsonName('Team View')).toBe('team-view.dashboard.json');
  });
});

describe('saving to the data folder through the server', () => {
  it('gives the file name the server chose', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ file: 'a.md' }) })));
    expect(await saveSnapshotFile('a', '# x')).toEqual({ ok: true, file: 'a.md' });
  });
  it('says no, without throwing, when the server refuses or cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await saveSnapshotFile('a', 'x')).toEqual({ ok: false });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await saveSnapshotFile('a', 'x')).toEqual({ ok: false });
  });
  it('lists the saved files, or none when it cannot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ files: [{ file: 'a.md', size: 1, modified: 'x' }] }) })));
    expect(await listSnapshotFiles()).toHaveLength(1);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    expect(await listSnapshotFiles()).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await listSnapshotFiles()).toEqual([]);
  });
});

describe('downloading text', () => {
  it('saves under the given name and leaves nothing behind', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: revoke });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    downloadText('a.md', 'hello');
    expect(clicked[0].download).toBe('a.md');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    vi.advanceTimersByTime(2000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
