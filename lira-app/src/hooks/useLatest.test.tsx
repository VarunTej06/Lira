import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount } from '../test/render';
import { useLatest } from './useLatest';

afterEach(cleanup);

/** Hands the ref back to the test after each render. */
const seen: { ref?: { current: number } } = {};
function Probe({ value }: { value: number }) {
  const ref = useLatest(value);
  useEffect(() => { seen.ref = ref; });
  return null;
}

describe('useLatest', () => {
  it('holds the first value straight away', () => {
    mount(<Probe value={1} />);
    expect(seen.ref!.current).toBe(1);
  });

  it('follows the newest value after each render, so a callback that outlives a render sees it', () => {
    const view = mount(<Probe value={1} />);
    const first = seen.ref;
    view.rerender(<Probe value={2} />);
    expect(seen.ref!.current).toBe(2);
    expect(seen.ref).toBe(first); // the same ref object every time, so it is safe to keep in a handler
  });
});
