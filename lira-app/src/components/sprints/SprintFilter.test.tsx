import { afterEach, describe, expect, it, vi } from 'vitest';
import { SprintFilter } from './SprintFilter';
import { EMPTY_FILTER } from './sprintFilterDefaults';
import { cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { makeSpace } from '../../test/factories';

afterEach(cleanup);

const spaces = [makeSpace({ id: 1, name: 'Lira', key: 'LIRA', icon: 'L' }), makeSpace({ id: 2, name: 'Courses', key: 'COUR', icon: 'C' }), makeSpace({ id: 3, name: 'Lifestyle', key: 'LIFE', icon: 'F' })];

describe('Sprint filter (Status and Space dropdowns)', () => {
  it('shows Status and Space side by side as two dropdowns', () => {
    mount(<SprintFilter spaces={spaces} value={EMPTY_FILTER} onChange={() => {}} />);
    expect(q('[data-testid=filter-status]')).not.toBeNull();
    expect(q('[data-testid=filter-space]')).not.toBeNull();
    expect(q('[data-testid=sprint-filter-clear]')).toBeNull(); // nothing to clear yet
  });

  it('lists the four statuses and Blocked with a checkbox each', async () => {
    mount(<SprintFilter spaces={spaces} value={EMPTY_FILTER} onChange={() => {}} />);
    await click(q('[data-testid=filter-status]'));
    await settle();
    expect(qa('[aria-label="Status filter"] label').map(l => l.textContent?.trim())).toEqual(['Backlog', 'To Do', 'In Progress', 'Done', 'Blocked']);
  });

  it('adds a status to the filter and keeps the chosen spaces', async () => {
    const onChange = vi.fn();
    mount(<SprintFilter spaces={spaces} value={{ statuses: [], spaceIds: [2] }} onChange={onChange} />);
    await click(q('[data-testid=filter-status]'));
    await settle();
    await click(qa('[aria-label="Status filter"] input[type=checkbox]')[1]); // To Do
    expect(onChange).toHaveBeenCalledWith({ statuses: ['todo'], spaceIds: [2] });
  });

  it('can search the spaces by typing, and choose several', async () => {
    const onChange = vi.fn();
    mount(<SprintFilter spaces={spaces} value={EMPTY_FILTER} onChange={onChange} />);
    await click(q('[data-testid=filter-space]'));
    await settle();
    await typeInto(q<HTMLInputElement>('[aria-label="Search or type a space"]'), 'li');
    expect(qa('[aria-label="Space filter"] label').map(l => l.textContent?.trim())).toEqual(['L Lira', 'F Lifestyle']);
    await click(qa('[aria-label="Space filter"] input[type=checkbox]')[0]);
    expect(onChange).toHaveBeenLastCalledWith({ statuses: [], spaceIds: [1] });
  });

  it('offers "Clear filter" once something is chosen, and clears everything', async () => {
    const onChange = vi.fn();
    mount(<SprintFilter spaces={spaces} value={{ statuses: ['done'], spaceIds: [1] }} onChange={onChange} />);
    await click(q('[data-testid=sprint-filter-clear]'));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTER);
  });
});
