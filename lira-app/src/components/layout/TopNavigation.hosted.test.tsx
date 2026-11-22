import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, mount, q } from '../../test/render';
import { TopNavigation } from './TopNavigation';

vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => true }));
vi.mock('../../services/localDiskSync', () => ({
  subscribeToSyncStatus: (cb: (s: { status: string; lastSaved: Date | null; filePath: string }) => void) => { cb({ status: 'error', lastSaved: null, filePath: 'data/x.json' }); return () => {}; },
  saveToDiskNow: vi.fn(),
}));

afterEach(cleanup);

describe('Top bar in the hosted edition', () => {
  it('has no "PC Saved" or "Save error" indicator, because nothing is saved to a local disk', () => {
    mount(<MemoryRouter><TopNavigation /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/PC Saved|Save error|Saving to PC/);
    expect(q('button[title^="Saved locally on your PC"]')).toBeNull();
    expect(q('button[title="Your account"]')).not.toBeNull();
  });
});
