import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { makeIssue, makeSpace } from '../../test/factories';
import { choose, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { forgetAssignees } from '../../hooks/useAssignees';
import { ChildIssues } from './ChildIssues';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
const write = vi.hoisted(() => ({ updateIssue: vi.fn(async () => undefined) }));
vi.mock('../../hooks/useIssues', () => write);
vi.mock('../../services/workspaceApi', () => ({ listAssignable: vi.fn(async () => ({ ok: true, data: [{ userId: 'u1', name: 'Asha Rao' }, { userId: 'u2', name: 'Ben Li' }] })) }));

const children = [
  makeIssue({ id: 11, key: 'LIRA-11', title: 'Design', type: 'task', spaceId: 1, assignee: 'Asha Rao', assigneeInitials: 'AR' }),
  makeIssue({ id: 12, key: 'LIRA-12', title: 'Build', type: 'task', spaceId: 1 }),
];
const who = (key: string) => q<HTMLSelectElement>(`select[aria-label="Assignee of ${key}"]`)!;

beforeEach(async () => {
  hosted.on = false; setActiveOrg(null); forgetAssignees(); write.updateIssue.mockClear(); localStorage.clear();
  await db.spaces.clear(); await db.spaces.put(makeSpace({ id: 1, key: 'LIRA', myLevel: 'edit' }));
});
afterEach(cleanup);

describe('the tickets under an epic or a task', () => {
  it('says so when there are none', () => {
    mount(<ChildIssues childIssues={[]} onIssueClick={vi.fn()} />);
    expect(q('[data-testid="no-children"]')).not.toBeNull();
  });

  it('lists each one with who it is given to, and a way to open it', async () => {
    const open = vi.fn();
    mount(<ChildIssues childIssues={children} onIssueClick={open} />);
    await settle(30);
    expect(who('LIRA-11').value).toBe('Asha Rao');
    expect(who('LIRA-12').value).toBe('');
    await click(qa('button').find(b => b.textContent?.includes('LIRA-12')));
    expect(open).toHaveBeenCalledWith(children[1]);
  });

  it('gives a ticket to someone from the list itself, without opening it, and saves only the person', async () => {
    const open = vi.fn();
    mount(<ChildIssues childIssues={children} onIssueClick={open} />);
    await settle(30);
    await choose(who('LIRA-12'), 'Sarah Connor');
    expect(write.updateIssue).toHaveBeenCalledWith(12, { assignee: 'Sarah Connor', assigneeInitials: 'SC' });
    expect(open).not.toHaveBeenCalled();
  });

  it('splits the work: each ticket can be given to a different person, and a ticket can be taken back', async () => {
    mount(<ChildIssues childIssues={children} onIssueClick={vi.fn()} />);
    await settle(30);
    await choose(who('LIRA-11'), 'Alex Morgan');
    await choose(who('LIRA-12'), 'Dev Team');
    await choose(who('LIRA-11'), '');
    expect(write.updateIssue.mock.calls).toEqual([
      [11, { assignee: 'Alex Morgan', assigneeInitials: 'AM' }], [12, { assignee: 'Dev Team', assigneeInitials: 'DT' }], [11, { assignee: undefined, assigneeInitials: undefined }],
    ]);
  });

  it('still changes the status in place', async () => {
    mount(<ChildIssues childIssues={children} onIssueClick={vi.fn()} />);
    await choose(q<HTMLSelectElement>('select[aria-label="Status of LIRA-12"]'), 'done');
    expect(write.updateIssue).toHaveBeenCalledWith(12, { status: 'done' });
  });

  it('offers the real people of the space in the hosted edition, and locks the list for someone who may only look at the space', async () => {
    hosted.on = true; setActiveOrg('org-1', 'member');
    mount(<ChildIssues childIssues={children} onIssueClick={vi.fn()} />);
    await settle(60);
    expect(qa('option', who('LIRA-12')).map(o => o.textContent)).toEqual(['Unassigned', 'Asha Rao (AR)', 'Ben Li (BL)']);
    expect(who('LIRA-12').disabled).toBe(false);
    cleanup();
    await db.spaces.put(makeSpace({ id: 1, key: 'LIRA', myLevel: 'view' }));
    mount(<ChildIssues childIssues={children} onIssueClick={vi.fn()} />);
    await settle(60);
    expect(who('LIRA-12').disabled).toBe(true);
  });
});
