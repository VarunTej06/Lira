import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, click, mount, q } from '../test/render';
import { useResetWhen } from './useResetWhen';

afterEach(cleanup);

/** A draft that starts from `source` and is reset whenever `source` changes. */
function Draft({ source, onReset }: { source: number; onReset?: () => void }) {
  const [draft, setDraft] = useState(-1);
  useResetWhen([source], () => { onReset?.(); setDraft(source * 10); });
  return <button data-testid="draft" onClick={() => setDraft(d => d + 1)}>{draft}</button>;
}

const shown = () => q('[data-testid="draft"]')!.textContent;

describe('useResetWhen', () => {
  it('runs on the first render, so the first paint already has the reset value', () => {
    mount(<Draft source={3} />);
    expect(shown()).toBe('30');
  });

  it('keeps what the person typed while the inputs stay the same', async () => {
    const view = mount(<Draft source={3} />);
    await click(q('[data-testid="draft"]'));
    expect(shown()).toBe('31');
    view.rerender(<Draft source={3} />);
    expect(shown()).toBe('31');
  });

  it('starts again when an input changes', async () => {
    const view = mount(<Draft source={3} />);
    await click(q('[data-testid="draft"]'));
    view.rerender(<Draft source={4} />);
    expect(shown()).toBe('40');
  });

  it('calls the reset once per change, not once per render', async () => {
    let calls = 0;
    const view = mount(<Draft source={1} onReset={() => { calls += 1; }} />);
    expect(calls).toBe(1);
    await click(q('[data-testid="draft"]'));
    await click(q('[data-testid="draft"]'));
    view.rerender(<Draft source={1} onReset={() => { calls += 1; }} />);
    expect(calls).toBe(1);
    view.rerender(<Draft source={2} onReset={() => { calls += 1; }} />);
    expect(calls).toBe(2);
  });

  it('compares inputs by identity, like a dependency list', () => {
    let calls = 0;
    const same = { id: 1 };
    function Probe({ item }: { item: { id: number } }) {
      useResetWhen([item], () => { calls += 1; });
      return null;
    }
    const view = mount(<Probe item={same} />);
    view.rerender(<Probe item={same} />);
    expect(calls).toBe(1);
    view.rerender(<Probe item={{ id: 1 }} />);
    expect(calls).toBe(2);
  });
});
