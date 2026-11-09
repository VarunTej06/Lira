import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appStorage } from './appStorage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('appStorage', () => {
  it('reads, writes and removes through the browser storage', () => {
    expect(appStorage.get('lira_demo')).toBeNull();
    appStorage.set('lira_demo', 'one');
    expect(appStorage.get('lira_demo')).toBe('one');
    expect(localStorage.getItem('lira_demo')).toBe('one');
    appStorage.remove('lira_demo');
    expect(appStorage.get('lira_demo')).toBeNull();
  });

  it('passes through the same errors the browser storage raises, so callers keep their own try/catch', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => appStorage.set('lira_demo', 'x')).toThrow('quota');
  });

  it('goes through the storage the page has now, so a mirror that wraps it still sees every write', () => {
    const seen: string[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) { seen.push(k); original.call(this, k, v); });
    appStorage.set('lira_watched', '1');
    expect(seen).toEqual(['lira_watched']);
  });
});
