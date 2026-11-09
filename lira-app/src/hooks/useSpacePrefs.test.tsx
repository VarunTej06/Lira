import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppRoute } from '../routes';
import type { Space } from '../types/space';
import { cleanup, click, mount, q } from '../test/render';
import { nextRememberedSpaceId, useActiveSpace, useSpacePrefs } from './useSpacePrefs';

const space = (id: number, key: string): Space => ({ id, key, name: key, icon: 'x', color: '#000000', createdAt: new Date(0), updatedAt: new Date(0) });
const SPACES = [space(1, 'AAA'), space(2, 'CERT'), space(3, 'ZZZ')];
const onSpace = (key: string): AppRoute => ({ kind: 'space', spaceKey: key, tab: 'Board' });
const elsewhere: AppRoute = { kind: 'forYou' };

function Active({ route, spaces }: { route: AppRoute; spaces: Space[] | undefined }) {
  const { activeSpace } = useActiveSpace(route, spaces);
  return <span data-testid="active">{activeSpace?.key ?? 'none'}</span>;
}
const active = () => q('[data-testid="active"]')!.textContent;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useActiveSpace', () => {
  it('shows the space named in the address and remembers it', () => {
    mount(<Active route={onSpace('ZZZ')} spaces={SPACES} />);
    expect(active()).toBe('ZZZ');
    expect(localStorage.getItem('lira_active_space_id')).toBe('3');
  });

  it('on other pages shows the space used last', () => {
    localStorage.setItem('lira_active_space_id', '3');
    mount(<Active route={elsewhere} spaces={SPACES} />);
    expect(active()).toBe('ZZZ');
  });

  it('falls back to CERT when the remembered space is gone', () => {
    localStorage.setItem('lira_active_space_id', '99');
    mount(<Active route={elsewhere} spaces={SPACES} />);
    expect(active()).toBe('CERT');
    expect(localStorage.getItem('lira_active_space_id')).toBe('2');
  });

  it('falls back to the first space when there is no CERT', () => {
    mount(<Active route={elsewhere} spaces={[space(7, 'ONE'), space(8, 'TWO')]} />);
    expect(active()).toBe('ONE');
  });

  it('shows nothing while the spaces are still loading', () => {
    mount(<Active route={elsewhere} spaces={undefined} />);
    expect(active()).toBe('none');
  });

  it('follows the address when the person moves to another space', () => {
    const view = mount(<Active route={onSpace('AAA')} spaces={SPACES} />);
    expect(active()).toBe('AAA');
    view.rerender(<Active route={onSpace('ZZZ')} spaces={SPACES} />);
    expect(active()).toBe('ZZZ');
    expect(localStorage.getItem('lira_active_space_id')).toBe('3');
  });
});

function Prefs() {
  const p = useSpacePrefs();
  return (
    <div>
      <span data-testid="hidden">{p.hiddenSpaceIds.join(',')}</span>
      <span data-testid="archived">{p.archivedSpaceIds.join(',')}</span>
      <button data-testid="hide2" onClick={() => p.toggleHideSpace(2)} />
      <button data-testid="hide5" onClick={() => p.toggleHideSpace(5)} />
      <button data-testid="archive2" onClick={() => p.toggleArchiveSpace(2)} />
      <button data-testid="unhide" onClick={p.unhideAllSpaces} />
    </div>
  );
}
const text = (id: string) => q(`[data-testid="${id}"]`)!.textContent;

describe('useSpacePrefs', () => {
  it('hides and un-hides a space, and remembers the list', async () => {
    mount(<Prefs />);
    await click(q('[data-testid="hide2"]'));
    await click(q('[data-testid="hide5"]'));
    expect(text('hidden')).toBe('2,5');
    expect(JSON.parse(localStorage.getItem('lira_hidden_spaces')!)).toEqual([2, 5]);
    await click(q('[data-testid="hide2"]'));
    expect(text('hidden')).toBe('5');
  });

  it('archives separately from hiding', async () => {
    mount(<Prefs />);
    await click(q('[data-testid="archive2"]'));
    expect(text('archived')).toBe('2');
    expect(text('hidden')).toBe('');
    expect(JSON.parse(localStorage.getItem('lira_archived_spaces')!)).toEqual([2]);
  });

  it('un-hides everything at once', async () => {
    mount(<Prefs />);
    await click(q('[data-testid="hide2"]'));
    await click(q('[data-testid="unhide"]'));
    expect(text('hidden')).toBe('');
    expect(localStorage.getItem('lira_hidden_spaces')).toBe('[]');
  });

  it('starts from what was saved before', () => {
    localStorage.setItem('lira_hidden_spaces', '[4,6]');
    mount(<Prefs />);
    expect(text('hidden')).toBe('4,6');
  });

  it('ignores a saved list it cannot read', () => {
    localStorage.setItem('lira_hidden_spaces', '{not json');
    mount(<Prefs />);
    expect(text('hidden')).toBe('');
  });
});

describe('nextRememberedSpaceId', () => {
  it('follows a space in the address that is not the remembered one', () => {
    expect(nextRememberedSpaceId(3, 1, SPACES)).toBe(3);
  });
  it('changes nothing when the address space is already remembered', () => {
    expect(nextRememberedSpaceId(1, 1, SPACES)).toBeUndefined();
  });
  it('changes nothing when the remembered space still exists', () => {
    expect(nextRememberedSpaceId(undefined, 3, SPACES)).toBeUndefined();
  });
  it('falls back to CERT when the remembered space is gone or nothing was remembered', () => {
    expect(nextRememberedSpaceId(undefined, 99, SPACES)).toBe(2);
    expect(nextRememberedSpaceId(undefined, undefined, SPACES)).toBe(2);
  });
  it('falls back to the first space when there is no CERT', () => {
    expect(nextRememberedSpaceId(undefined, 99, [space(5, 'A'), space(6, 'B')])).toBe(5);
  });
  it('does nothing while the spaces are not loaded or there are none', () => {
    expect(nextRememberedSpaceId(undefined, 1, undefined)).toBeUndefined();
    expect(nextRememberedSpaceId(undefined, 1, [])).toBeUndefined();
  });
});
