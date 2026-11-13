import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, click, mount, q } from '../test/render';
import { useCreateIssueDialog } from './useCreateIssueDialog';

afterEach(cleanup);

function Probe() {
  const d = useCreateIssueDialog();
  return (
    <div>
      <span data-testid="state">{JSON.stringify({ isOpen: d.isOpen, status: d.status, sprint: d.sprint ?? null, spaceId: d.spaceId ?? null, chooseSpace: d.chooseSpace })}</span>
      <button data-testid="plain" onClick={() => d.open('todo')} />
      <button data-testid="full" onClick={() => d.open('inprogress', { sprint: '2026-12', spaceId: 4, chooseSpace: true })} />
      <button data-testid="close" onClick={d.close} />
    </div>
  );
}
const state = () => JSON.parse(q('[data-testid="state"]')!.textContent!);

describe('useCreateIssueDialog', () => {
  it('starts closed with To Do', () => {
    mount(<Probe />);
    expect(state()).toEqual({ isOpen: false, status: 'todo', sprint: null, spaceId: null, chooseSpace: false });
  });
  it('opens with the status, and with sprint, space and choose-space when given', async () => {
    mount(<Probe />);
    await click(q('[data-testid="full"]'));
    expect(state()).toEqual({ isOpen: true, status: 'inprogress', sprint: '2026-12', spaceId: 4, chooseSpace: true });
  });
  it('forgets the options of an earlier opening', async () => {
    mount(<Probe />);
    await click(q('[data-testid="full"]'));
    await click(q('[data-testid="plain"]'));
    expect(state()).toEqual({ isOpen: true, status: 'todo', sprint: null, spaceId: null, chooseSpace: false });
  });
  it('closes', async () => {
    mount(<Probe />);
    await click(q('[data-testid="plain"]'));
    await click(q('[data-testid="close"]'));
    expect(state().isOpen).toBe(false);
  });
});
