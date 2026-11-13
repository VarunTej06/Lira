import { afterEach, describe, expect, it } from 'vitest';
import type { Issue } from '../../../types/issue';
import { cleanup, click, mount, q } from '../../../test/render';
import { useIssueDraft } from './useIssueDraft';

afterEach(cleanup);

const t = (over: Partial<Issue> = {}) => ({ id: 1, key: 'A-1', title: 'One', description: 'd1', comments: [], ...over }) as unknown as Issue;

function Probe({ issue }: { issue: Issue | null }) {
  const d = useIssueDraft(issue);
  return (
    <div>
      <span data-testid="s">{JSON.stringify({ local: d.local?.title ?? null, title: d.titleVal, desc: d.descVal, editing: d.editingTitle, detach: d.detachChildren, comments: d.local?.comments?.length ?? null, same: d.local === issue })}</span>
      <button data-testid="edit" onClick={() => { d.setTitleVal('Typed'); d.setEditingTitle(true); d.setDetachChildren(true); }} />
    </div>
  );
}
const state = () => JSON.parse(q('[data-testid="s"]')!.textContent!);
const edit = () => click(q('[data-testid="edit"]'));

describe('useIssueDraft', () => {
  it('has no draft without a ticket', () => {
    mount(<Probe issue={null} />);
    expect(state()).toMatchObject({ local: null, title: '', desc: '' });
  });
  it('starts a draft from the ticket, as a copy', () => {
    mount(<Probe issue={t()} />);
    expect(state()).toMatchObject({ local: 'One', title: 'One', desc: 'd1', editing: false, detach: false, same: false });
  });
  it('keeps edits when the same ticket is shown again', async () => {
    const m = mount(<Probe issue={t()} />);
    await edit();
    m.rerender(<Probe issue={t({ title: 'One' })} />);
    expect(state()).toMatchObject({ title: 'Typed', editing: true, detach: true });
  });
  it('starts fresh for another ticket, dropping the title box, detach flag and edits', async () => {
    const m = mount(<Probe issue={t()} />);
    await edit();
    m.rerender(<Probe issue={t({ id: 2, title: 'Two', description: 'd2' })} />);
    expect(state()).toMatchObject({ local: 'Two', title: 'Two', desc: 'd2', editing: false, detach: false });
  });
  it('follows comments saved at once, without losing other edits', async () => {
    const m = mount(<Probe issue={t()} />);
    await edit();
    m.rerender(<Probe issue={t({ comments: [{ id: 'c' }] as never })} />);
    expect(state()).toMatchObject({ title: 'Typed', comments: 1 });
  });
  it('goes back to no draft when the ticket closes', () => {
    const m = mount(<Probe issue={t()} />);
    m.rerender(<Probe issue={null} />);
    expect(state().local).toBeNull();
  });
});
