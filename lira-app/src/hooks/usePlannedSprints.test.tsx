import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, mount, q } from '../test/render';
import { SPRINTS_EVENT, addPlannedSprint } from '../utils/sprintUtils';
import { usePlannedSprints } from './usePlannedSprints';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function Probe() {
  return <span data-testid="list">{usePlannedSprints().join(',')}</span>;
}

describe('usePlannedSprints', () => {
  it('lists the planned sprints', () => {
    addPlannedSprint('2026-12');
    mount(<Probe />);
    expect(q('[data-testid="list"]')!.textContent).toBe('2026-12');
  });
  it('reads the list again when a sprint is planned', async () => {
    mount(<Probe />);
    expect(q('[data-testid="list"]')!.textContent).toBe('');
    await act(async () => { addPlannedSprint('2027-01'); });
    expect(q('[data-testid="list"]')!.textContent).toBe('2027-01');
  });
  it('stops listening when it goes away', () => {
    const m = mount(<Probe />);
    m.unmount();
    expect(() => window.dispatchEvent(new Event(SPRINTS_EVENT))).not.toThrow();
  });
});
