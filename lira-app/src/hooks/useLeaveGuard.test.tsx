import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount } from '../test/render';
import { hasLeaveGuard, setLeaveGuard } from '../utils/leaveGuard';
import { useLeaveGuard } from './useLeaveGuard';

afterEach(() => { cleanup(); setLeaveGuard(null); vi.restoreAllMocks(); });

function Probe({ message }: { message: string | null }) {
  useLeaveGuard(message);
  return null;
}

describe('guarding a page while something is in progress', () => {
  it('holds the guard while there is a message, and lets go of it when the page goes away', () => {
    const view = mount(<Probe message="A ticket is being voted on." />);
    expect(hasLeaveGuard()).toBe(true);
    view.unmount();
    expect(hasLeaveGuard()).toBe(false);
  });

  it('changes with the message: on, then off when there is nothing to lose', () => {
    const view = mount(<Probe message="x" />);
    expect(hasLeaveGuard()).toBe(true);
    view.rerender(<Probe message={null} />);
    expect(hasLeaveGuard()).toBe(false);
    view.rerender(<Probe message="y" />);
    expect(hasLeaveGuard()).toBe(true);
  });

  it('asks the browser before the tab is closed or reloaded only while guarded', () => {
    const add = vi.spyOn(window, 'addEventListener'); const remove = vi.spyOn(window, 'removeEventListener');
    const view = mount(<Probe message="x" />);
    const warn = add.mock.calls.find(c => c[0] === 'beforeunload')![1] as (e: BeforeUnloadEvent) => void;
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    warn(event);
    expect(event.defaultPrevented).toBe(true);
    view.rerender(<Probe message={null} />);
    expect(remove).toHaveBeenCalledWith('beforeunload', warn);
    expect(add.mock.calls.filter(c => c[0] === 'beforeunload')).toHaveLength(1); // nothing was added for the empty message
  });
});
