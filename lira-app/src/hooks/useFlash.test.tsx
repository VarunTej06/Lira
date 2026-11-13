import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q } from '../test/render';
import { useFlash } from './useFlash';

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

function Probe() {
  const { message, flash } = useFlash(1000);
  return (
    <div>
      <span data-testid="msg">{message ?? ''}</span>
      <button data-testid="a" onClick={() => flash('first')} />
      <button data-testid="b" onClick={() => flash('second')} />
    </div>
  );
}
const msg = () => q('[data-testid="msg"]')!.textContent;
const click = (el: Element | null) => act(() => { (el as HTMLElement).click(); });
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('useFlash', () => {
  it('shows a message and clears it after the time', () => {
    mount(<Probe />);
    click(q('[data-testid="a"]'));
    expect(msg()).toBe('first');
    tick(999);
    expect(msg()).toBe('first');
    tick(1);
    expect(msg()).toBe('');
  });
  it('restarts the time when a new message comes, so it is not cut short', () => {
    mount(<Probe />);
    click(q('[data-testid="a"]'));
    tick(800);
    click(q('[data-testid="b"]'));
    tick(800);
    expect(msg()).toBe('second');
    tick(200);
    expect(msg()).toBe('');
  });
  it('does nothing after it is gone', () => {
    const m = mount(<Probe />);
    click(q('[data-testid="a"]'));
    m.unmount();
    expect(() => tick(2000)).not.toThrow();
  });
});
