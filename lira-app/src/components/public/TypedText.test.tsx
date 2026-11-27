import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q } from '../../test/render';
import { TypedText } from './TypedText';

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query })); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

/** One letter's time, a number of times, with the page given a chance to draw between each. */
const letters = async (n: number) => { for (let i = 0; i < n; i++) await act(async () => { await vi.advanceTimersByTimeAsync(100); }); };
const Probe = ({ text }: { text: string }) => <p id="t"><TypedText text={text} letterMs={100} /></p>;

describe('TypedText', () => {
  it('starts empty and adds one letter at a time until the whole word is there', async () => {
    mount(<Probe text="anywhere" />);
    expect(q('#t')!.textContent).toBe('');
    await letters(1);
    expect(q('#t')!.textContent).toBe('a');
    await letters(3);
    expect(q('#t')!.textContent).toBe('anyw');
    await letters(4);
    expect(q('#t')!.textContent).toBe('anywhere');
  });

  it('holds the whole word for two seconds, then empties and types it again', async () => {
    mount(<Probe text="hi" />);
    await letters(2);
    expect(q('#t')!.textContent).toBe('hi');
    await act(async () => { await vi.advanceTimersByTimeAsync(1900); });
    expect(q('#t')!.textContent).toBe('hi');
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(q('#t')!.textContent).toBe('');
    await letters(1);
    expect(q('#t')!.textContent).toBe('h');
  });

  it('starts again from nothing when it is mounted again', async () => {
    mount(<Probe text="hi" />);
    await letters(5);
    expect(q('#t')!.textContent).toBe('hi');
    cleanup();
    mount(<Probe text="hi" />);
    expect(q('#t')!.textContent).toBe('');
  });

  it('shows the whole word at once when the person asked for less motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    mount(<Probe text="anywhere" />);
    expect(q('#t')!.textContent).toBe('anywhere');
    expect(vi.getTimerCount()).toBe(0);
  });
});
