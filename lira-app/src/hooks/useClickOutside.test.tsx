import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { cleanup, mount, q } from '../test/render';
import { useClickOutside } from './useClickOutside';

afterEach(cleanup);

function Probe({ handler }: { handler: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, handler);
  return <div><div ref={ref} id="inside"><button id="in">in</button></div><button id="out">out</button></div>;
}
const press = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

describe('closing a menu with a click outside it', () => {
  it('calls the handler for a press outside the element, and not for a press inside it', () => {
    const handler = vi.fn();
    mount(<Probe handler={handler} />);
    press(q('#in')!);
    press(q('#inside')!);
    expect(handler).not.toHaveBeenCalled();
    press(q('#out')!);
    expect(handler).toHaveBeenCalledTimes(1);
    press(document.body);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('stops listening when the menu goes away, so a press later calls nothing', () => {
    const handler = vi.fn();
    const view = mount(<Probe handler={handler} />);
    view.unmount();
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it('uses the newest handler after a render', () => {
    const first = vi.fn(); const second = vi.fn();
    const view = mount(<Probe handler={first} />);
    view.rerender(<Probe handler={second} />);
    press(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does nothing before the element exists', () => {
    const handler = vi.fn();
    function Late() { const ref = useRef<HTMLDivElement>(null); useClickOutside(ref, handler); return null; }
    mount(<Late />);
    press(document.body);
    expect(handler).not.toHaveBeenCalled();
  });
});
