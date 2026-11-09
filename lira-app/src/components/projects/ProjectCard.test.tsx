import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Project } from '../../types/project';
import type { Space } from '../../types/space';
import { cleanup, click, mount, q } from '../../test/render';

vi.mock('../standup/StandupButton', () => ({ StandupButton: () => <button data-testid="standup">standup</button> }));

import { ProjectCard } from './ProjectCard';

afterEach(cleanup);

const space = (over: Partial<Space> = {}) => ({ id: 1, key: 'AAA', name: 'Alpha', icon: 'A', color: '#336699', ...over }) as Space;
const project = (over: Partial<Project> = {}) => ({ id: 'p1', name: 'Lira Core', key: 'AAA', description: 'About it', lead: 'Varun Tej', spaceId: 1, category: 'Platform', ...over }) as Project;
let n = 0;
const issue = (status: string, over: Partial<Issue> = {}) => ({ id: ++n, key: `AAA-${n}`, status, spaceId: 1, type: 'task', ...over }) as unknown as Issue;

function show(p: Project, spaces: Space[], issues: Issue[] = []) {
  const onOpen = vi.fn();
  mount(<ProjectCard project={p} spaces={spaces} issues={issues} onOpen={onOpen} />);
  return onOpen;
}
const text = () => document.body.textContent!;

describe('ProjectCard', () => {
  it('shows name, key, category and description', () => {
    show(project(), [space()]);
    expect(q('h2')!.textContent).toBe('Lira Core');
    expect(text()).toContain('AAA');
    expect(text()).toContain('Platform');
    expect(text()).toContain('About it');
  });
  it('has fallbacks for category and description', () => {
    show(project({ category: undefined, description: '' } as never), [space()]);
    expect(text()).toContain('Software');
    expect(text()).toContain('No project description provided.');
  });
  it('opens on click, but not from the standup button', async () => {
    const onOpen = show(project(), [space()]);
    await click(q('[data-testid="standup"]'));
    expect(onOpen).not.toHaveBeenCalled();
    await click(q('h2'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });
  describe('space', () => {
    it('shows the linked space by id', () => {
      show(project(), [space()]);
      expect(text()).toContain('Alpha');
      expect(text()).not.toContain('Unlinked Space');
    });
    it('falls back to the space with the project key', () => {
      show(project({ spaceId: 99 }), [space({ id: 2, key: 'AAA', name: 'Keyed' })]);
      expect(text()).toContain('Keyed');
    });
    it('says Unlinked Space with none, and uses the default colour and icon', () => {
      show(project({ spaceId: 99, key: 'ZZZ' }), [space()]);
      expect(text()).toContain('Unlinked Space');
      expect(text()).toContain('📁');
    });
  });
  describe('lead', () => {
    it('shows the lead and their initials', () => {
      show(project(), [space()]);
      expect(text()).toContain('VA');
      expect(text()).toContain('Varun Tej');
    });
    it('falls back to VY / Varun Tej', () => {
      show(project({ lead: '' } as never), [space()]);
      expect(text()).toContain('VY');
      expect(text()).toContain('Varun Tej');
    });
  });
  describe('progress', () => {
    it('counts issues of the project and how many are done, in singular and plural', () => {
      show(project(), [space()], [issue('done'), issue('todo'), issue('DONE')]);
      expect(text()).toMatch(/issues \(.* done\)/);
      cleanup();
      show(project(), [space()], [issue('todo')]);
      expect(text()).toMatch(/issue \(/);
      expect(text()).not.toMatch(/issues \(/);
    });
    it('shows a bar of the done share, and 0 with no issues', () => {
      show(project(), [space()], [issue('done'), issue('todo')]);
      expect(text()).toContain('%');
      cleanup();
      show(project(), [space()], []);
      expect(text()).toMatch(/issues \(/);
    });
  });
});
