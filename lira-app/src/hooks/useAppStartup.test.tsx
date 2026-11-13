import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, mount, q, settle } from '../test/render';

const calls = vi.hoisted(() => [] as string[]);
vi.mock('../db/db', () => ({ requestDurableStorage: async () => { calls.push('durable'); } }));
vi.mock('../services/localDiskSync', () => ({ initLocalDiskSync: async () => { calls.push('disk'); } }));
vi.mock('../services/roadmapEpics', () => ({ syncPendingRoadmaps: async () => { calls.push('roadmaps'); } }));
vi.mock('../utils/sprintUtils', () => ({ stampLegacySprints: async () => { calls.push('sprints'); } }));

import { useAppStartup } from './useAppStartup';

afterEach(() => { cleanup(); calls.length = 0; });

function Probe() {
  return <span data-testid="ready">{String(useAppStartup())}</span>;
}

describe('useAppStartup', () => {
  it('is not ready at first, then runs the four steps in order and becomes ready', async () => {
    mount(<Probe />);
    expect(q('[data-testid="ready"]')!.textContent).toBe('false');
    await settle();
    expect(calls).toEqual(['durable', 'disk', 'sprints', 'roadmaps']);
    expect(q('[data-testid="ready"]')!.textContent).toBe('true');
  });
});
