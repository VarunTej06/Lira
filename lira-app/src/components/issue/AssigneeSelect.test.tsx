import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { choose, cleanup, mount, q, qa } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { forgetAssignees } from '../../hooks/useAssignees';
import { AssigneeSelect } from './AssigneeSelect';

const hosted = vi.hoisted(() => ({ on: false }));
vi.mock('../../utils/edition', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/edition')>()), isHosted: () => hosted.on }));
vi.mock('../../services/workspaceApi', () => ({ listAssignable: vi.fn(async () => ({ ok: true, data: [{ userId: 'u1', name: 'Asha Rao' }] })) }));

beforeEach(() => { hosted.on = false; setActiveOrg(null); forgetAssignees(); localStorage.clear(); });
afterEach(cleanup);

const select = () => q<HTMLSelectElement>('select[aria-label="Assignee of LIRA-1"]')!;
const show = (over: Partial<Parameters<typeof AssigneeSelect>[0]> = {}) => {
  const onChange = vi.fn();
  mount(<AssigneeSelect spaceId={1} assignee={undefined} initials={undefined} label="Assignee of LIRA-1" onChange={onChange} {...over} />);
  return onChange;
};

describe('choosing who a ticket is given to', () => {
  it('shows Unassigned with an empty circle when nobody has it, and the person with their picture when someone has', () => {
    show();
    expect(select().value).toBe('');
    expect(q('[aria-hidden="true"].border-dashed')).not.toBeNull();
    cleanup();
    show({ assignee: 'Alex Morgan', initials: 'AM' });
    expect(select().value).toBe('Alex Morgan');
    expect(q('[aria-hidden="true"].border-dashed')).toBeNull();
  });

  it('hands back the name and the initials of the person chosen, and clears both for Unassigned', async () => {
    const onChange = show({ assignee: 'Alex Morgan', initials: 'AM' });
    await choose(select(), 'Sarah Connor');
    expect(onChange).toHaveBeenLastCalledWith({ assignee: 'Sarah Connor', assigneeInitials: 'SC' });
    await choose(select(), '');
    expect(onChange).toHaveBeenLastCalledWith({ assignee: undefined, assigneeInitials: undefined });
  });

  it('keeps someone who has the ticket in the list even when they are not offered any more', () => {
    show({ assignee: 'Left Company', initials: 'LC' });
    expect(qa('option', select()).map(o => o.textContent)).toContain('Left Company (LC)');
    expect(select().value).toBe('Left Company');
  });

  it('knows the first version\'s letters for the person who made Lira', () => {
    show({ assignee: 'VY', initials: 'VY' });
    expect(select().value).toBe('Varuntej Yadla');
  });

  it('cannot be changed when it is off, and a click on it does not reach what is behind it', () => {
    const behind = vi.fn();
    const onChange = vi.fn();
    mount(<div onClick={behind}><AssigneeSelect spaceId={1} assignee={undefined} initials={undefined} label="Assignee of LIRA-1" disabled onChange={onChange} /></div>);
    expect(select().disabled).toBe(true);
    select().click();
    expect(behind).not.toHaveBeenCalled();
  });

  it('offers the people of the space in the hosted edition, and not the sample team', async () => {
    hosted.on = true; setActiveOrg('org-1', 'member');
    show();
    await new Promise(r => setTimeout(r, 30));
    expect(qa('option', select()).map(o => o.textContent)).toEqual(['Unassigned', 'Asha Rao (AR)']);
  });
});
