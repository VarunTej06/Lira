import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { cleanup, mount, q, settle } from '../test/render';
import { setLeaveGuard } from '../utils/leaveGuard';
import { useGuardedNavigate } from './useGuardedNavigate';
import { useLeaveGuard } from './useLeaveGuard';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../components/common/dialogStore', () => dialog);

afterEach(() => { cleanup(); setLeaveGuard(null); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true); });

function Probe({ guard }: { guard: string | null }) {
  const go = useGuardedNavigate();
  useLeaveGuard(guard);
  return <div><p id="at">{useLocation().pathname}</p><button id="go" onClick={() => go('/mindmaps')} /><button id="back" onClick={() => go(-1)} /></div>;
}
const show = (guard: string | null) => mount(<MemoryRouter initialEntries={['/a', '/storyboxes/b1']} initialIndex={1}><Probe guard={guard} /></MemoryRouter>);
const press = async (id: string) => { await act(async () => { q<HTMLButtonElement>(`#${id}`)!.click(); }); await settle(10); };

describe('going to another page', () => {
  it('goes at once, in the same moment, when nothing is guarded', async () => {
    show(null);
    await act(async () => { q<HTMLButtonElement>('#go')!.click(); });
    expect(q('#at')!.textContent).toBe('/mindmaps');
    expect(dialog.confirmDialog).not.toHaveBeenCalled();
  });

  it('asks first when the page holds a guard, stays when the answer is no, and goes when it is yes', async () => {
    show('A ticket is being voted on.');
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await press('go');
    expect(q('#at')!.textContent).toBe('/storyboxes/b1');
    await press('go');
    expect(q('#at')!.textContent).toBe('/mindmaps');
    expect(dialog.confirmDialog).toHaveBeenCalledTimes(2);
  });

  it('guards going back by a number too', async () => {
    show('x');
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await press('back');
    expect(q('#at')!.textContent).toBe('/storyboxes/b1');
    await press('back');
    expect(q('#at')!.textContent).toBe('/a');
  });

  it('stops guarding when the page lets go of the guard, and warns on closing the tab only while it holds one', () => {
    const add = vi.spyOn(window, 'addEventListener'); const remove = vi.spyOn(window, 'removeEventListener');
    const view = show('x');
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    view.unmount();
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    add.mockRestore(); remove.mockRestore();
    show(null);
    return act(async () => { q<HTMLButtonElement>('#go')!.click(); }).then(() => expect(dialog.confirmDialog).not.toHaveBeenCalled());
  });
});
