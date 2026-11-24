import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasLeaveGuard, mayLeave, setLeaveGuard } from './leaveGuard';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../components/common/dialogStore', () => dialog);

afterEach(() => { setLeaveGuard(null); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true); });

describe('asking before someone leaves a page', () => {
  it('lets them go without asking when nothing is guarded', async () => {
    expect(hasLeaveGuard()).toBe(false);
    expect(await mayLeave()).toBe(true);
    expect(dialog.confirmDialog).not.toHaveBeenCalled();
  });
  it('asks with the page\'s own words and goes by the answer', async () => {
    setLeaveGuard('A ticket is being voted on.');
    expect(hasLeaveGuard()).toBe(true);
    dialog.confirmDialog.mockResolvedValueOnce(false);
    expect(await mayLeave()).toBe(false);
    expect(dialog.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ message: 'A ticket is being voted on.', cancelLabel: 'Stay', confirmLabel: 'Leave' }));
    expect(await mayLeave()).toBe(true);
  });
  it('stops asking once the guard is cleared', async () => {
    setLeaveGuard('x');
    setLeaveGuard(null);
    expect(await mayLeave()).toBe(true);
    expect(dialog.confirmDialog).not.toHaveBeenCalled();
  });
});
