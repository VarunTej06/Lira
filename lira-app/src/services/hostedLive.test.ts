import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noteOf, startHostedLive, stopHostedLive } from './hostedLive';

const refresh = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./hostedRefresh', () => ({ refreshFromServer: refresh }));
const collections = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./kvMirror', () => ({ refreshCollections: collections }));

class FakeSource {
  static all: FakeSource[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  url: string;
  constructor(url: string) { this.url = url; FakeSource.all.push(this); }
  close() { this.closed = true; }
  say(data: unknown) { this.onmessage?.({ data }); }
}

beforeEach(() => { vi.useFakeTimers(); refresh.mockClear(); collections.mockClear(); FakeSource.all = []; vi.stubGlobal('EventSource', FakeSource); });
afterEach(() => { stopHostedLive(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const note = (kind: string, spaceId: number | null) => JSON.stringify({ kind, spaceId });

describe('reading a note', () => {
  it('gives what a note is about, the space or null for everything', () => {
    expect(noteOf(note('ticket', 4))).toEqual({ kind: 'ticket', spaceId: 4 });
    expect(noteOf(note('space', null))).toEqual({ kind: 'space', spaceId: null });
    expect(noteOf(note('object', null))).toEqual({ kind: 'object', spaceId: null });
  });

  it('ignores anything that is not a note', () => {
    for (const bad of [undefined, 5, '', 'nope', 'null', note('kv', 1), JSON.stringify({ kind: 'ticket', spaceId: '4' }), JSON.stringify({ kind: 'ticket', spaceId: 1.5 }), JSON.stringify({ kind: 'ticket' })]) {
      expect(noteOf(bad), String(bad)).toBeUndefined();
    }
  });
});

describe('the live stream', () => {
  it('opens one stream for the organisation, however often it is asked', () => {
    startHostedLive('org 1');
    startHostedLive('org 1');
    expect(FakeSource.all).toHaveLength(1);
    expect(FakeSource.all[0].url).toBe('/api/orgs/org%201/events');
  });

  it('refreshes the one space a burst of notes is about, once', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say(note('ticket', 4)); s.say(note('ticket', 4)); s.say(note('ticket', 4));
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(4);
  });

  it('refreshes everything once when the notes are about several spaces or about everything', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say(note('ticket', 4)); s.say(note('ticket', 5));
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenLastCalledWith(null);
    s.say(note('space', null));
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenLastCalledWith(null);
  });

  it('ignores a note that is not one, and refreshes everything after a break once the stream is back', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say('junk');
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).not.toHaveBeenCalled();
    s.onopen?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).not.toHaveBeenCalled(); // the first opening is not a return
    s.onerror?.();
    s.onopen?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenCalledWith(null);
  });

  it('closes the stream and drops what was waiting when stopped, and can be started again', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say(note('ticket', 4));
    stopHostedLive();
    await vi.advanceTimersByTimeAsync(300);
    expect(s.closed).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    startHostedLive('o');
    expect(FakeSource.all).toHaveLength(2);
  });

  it('reads the projects, roadmaps, dashboards, storyboards and story boxes again when one changed, once for a burst, and not the tickets', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say(note('object', null)); s.say(note('object', null)); s.say(note('object', null));
    await vi.advanceTimersByTimeAsync(300);
    expect(collections).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does both when a burst has tickets and objects, and reads everything after a break', async () => {
    startHostedLive('o');
    const s = FakeSource.all[0];
    s.say(note('ticket', 4)); s.say(note('object', null));
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenCalledWith(4);
    expect(collections).toHaveBeenCalledTimes(1);
    s.onerror?.(); s.onopen?.();
    await vi.advanceTimersByTimeAsync(300);
    expect(refresh).toHaveBeenLastCalledWith(null);
    expect(collections).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a browser that has no event streams', () => {
    vi.stubGlobal('EventSource', undefined);
    expect(() => startHostedLive('o')).not.toThrow();
    expect(FakeSource.all).toHaveLength(0);
  });
});
