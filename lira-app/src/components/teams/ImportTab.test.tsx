import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, settle } from '../../test/render';
import { ImportTab } from './ImportTab';

const run = vi.hoisted(() => vi.fn());
vi.mock('../../services/hostedImport', () => ({ importWorkspace: run }));

const file = (name: string, json: unknown, path = name) => {
  const f = new File([JSON.stringify(json)], name, { type: 'application/json' });
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
};
async function choose(...files: File[]) {
  const input = q<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await settle(30);
}
const workspace = { spaces: [{ id: 1, key: 'AAA', name: 'A', icon: 'x', color: '#336699' }], issues: [{ id: 1, spaceId: 1, key: 'AAA-1', title: 'T', type: 'task', status: 'todo', priority: 'medium' }] };

beforeEach(() => { run.mockReset(); });
afterEach(cleanup);

describe('the import tab', () => {
  it('shows nothing to import until files are chosen, and says what it found, with a note for what it did not use', async () => {
    mount(<ImportTab org="o" />);
    expect(q('[role="status"]')).toBeNull();
    await choose(file('lira-workspace.json', workspace), file('settings.json', { theme: 'dark' }));
    expect(q('[role="status"]')!.textContent).toContain('Found 1 spaces, 1 tickets');
    expect(q('[role="status"]')!.textContent).toContain('Not used: settings.json');
    expect(run).not.toHaveBeenCalled(); // nothing is sent until Import is pressed
  });

  it('never reads the secrets folder, backups or files that are not JSON', async () => {
    mount(<ImportTab org="o" />);
    await choose(file('keys.json', workspace, 'data/private/keys.json'), file('old.json.bak', workspace), file('notes.txt', workspace), file('lira-workspace.json', workspace, 'data/lira-workspace.json'));
    expect(q('[role="status"]')!.textContent).toContain('Found 1 spaces');
    await choose(file('keys.json', workspace, 'data/private/keys.json'));
    expect(q('[role="status"]')).toBeNull();
  });

  it('imports into the organisation on the button, shows progress, then what was made and what was not', async () => {
    run.mockImplementation(async (_o: string, _b: unknown, progress: (d: number, t: number) => void) => { progress(1, 2); return { made: { spaces: 1, tickets: 1, projects: 0, roadmaps: 0, dashboards: 0 }, problems: ['AAA-2: Use at most 500 characters.'] }; });
    mount(<ImportTab org="org-9" />);
    await choose(file('lira-workspace.json', workspace));
    await click(byText('button', 'Import'));
    await settle(30);
    expect(run.mock.calls[0][0]).toBe('org-9');
    expect(q('[role="status"]')!.textContent).toContain('Imported 1 spaces, 1 tickets');
    expect(q('[role="status"]')!.textContent).toContain('AAA-2: Use at most 500 characters.');
    expect(byText('button', 'Import')).toBeUndefined();
  });

  it('will not import when there is nothing usable', async () => {
    mount(<ImportTab org="o" />);
    await choose(file('settings.json', { theme: 'dark' }));
    expect(byText<HTMLButtonElement>('button', 'Import')!.disabled).toBe(true);
  });
});
