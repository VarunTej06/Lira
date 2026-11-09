import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockedToggle } from './BlockedToggle';
import { db } from '../../../db/db';
import { makeIssue } from '../../../test/factories';
import { byText, cleanup, click, mount, press, q, qa, settle, typeInto } from '../../../test/render';

const me = makeIssue({ id: 100, key: 'LIRA-100', title: 'The ticket being edited', spaceId: 1 });
const a = makeIssue({ id: 101, key: 'LIRA-101', title: 'Set up the database', type: 'task' });
const b = makeIssue({ id: 102, key: 'LIRA-102', title: 'Fix login bug', type: 'bug' });
const c = makeIssue({ id: 103, key: 'LIRA-103', title: 'Platform epic', type: 'epic' });
const finished = makeIssue({ id: 104, key: 'LIRA-104', title: 'Already finished', status: 'done' });

beforeEach(async () => {
  await db.issues.clear();
  await db.issues.bulkAdd([me, a, b, c, finished]);
});
afterEach(cleanup);

const toggle = (props: Partial<React.ComponentProps<typeof BlockedToggle>> = {}) => {
  const onChange = vi.fn();
  mount(<BlockedToggle issue={me} blocked={false} blockers={[]} blocking={[]} onChange={onChange} {...props} />);
  return onChange;
};

describe('Blocked switch', () => {
  it('is a two-part pill: Not blocked | Blocked, with the current one selected', () => {
    toggle();
    expect(q('[data-testid=blocked-off]')!.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-testid=blocked-on]')!.getAttribute('aria-checked')).toBe('false');
    cleanup();
    toggle({ blocked: true, blockers: [a] });
    expect(q('[data-testid=blocked-on]')!.getAttribute('aria-checked')).toBe('true');
    expect(q('[data-testid=blocked-pill]')!.className).toContain('lira-fire'); // the flames burn while it is on
  });

  it('turning it on asks which tickets block it, lists open ones only, and never the ticket itself', async () => {
    toggle();
    await click(q('[data-testid=blocked-on]'));
    await settle(250);
    expect(q('[data-testid=blocker-picker]')).not.toBeNull();
    await settle(100);
    const keys = qa('[data-testid^="blocker-LIRA-"]').map(e => e.getAttribute('data-testid'));
    expect(keys).toEqual(expect.arrayContaining(['blocker-LIRA-101', 'blocker-LIRA-102', 'blocker-LIRA-103']));
    expect(keys).not.toContain('blocker-LIRA-100'); // itself
    expect(keys).not.toContain('blocker-LIRA-104'); // already done
  });

  it('several tickets can be chosen; Mark as blocked waits for a choice and then reports all of them', async () => {
    const onChange = toggle();
    await click(q('[data-testid=blocked-on]'));
    await settle(300);
    const confirm = () => q<HTMLButtonElement>('[data-testid=blocker-confirm]')!;
    expect(confirm().disabled).toBe(true);
    await click(q('[data-testid="blocker-LIRA-101"] input'));
    await click(q('[data-testid="blocker-LIRA-103"] input'));
    expect(confirm().disabled).toBe(false);
    await click(confirm());
    expect(onChange).toHaveBeenCalledWith([101, 103]);
  });

  it('the picker can search by key or title and narrow by type', async () => {
    toggle();
    await click(q('[data-testid=blocked-on]'));
    await settle(300);
    await typeInto(q<HTMLInputElement>('[aria-label="Search tickets"]'), 'login');
    expect(qa('[data-testid^="blocker-LIRA-"]').map(e => e.getAttribute('data-testid'))).toEqual(['blocker-LIRA-102']);
    await typeInto(q<HTMLInputElement>('[aria-label="Search tickets"]'), '');
    await click(byText('[aria-label="Ticket type"] button', 'Epics'));
    expect(qa('[data-testid^="blocker-LIRA-"]').map(e => e.getAttribute('data-testid'))).toEqual(['blocker-LIRA-103']);
  });

  it('Escape closes the picker without blocking anything', async () => {
    const onChange = toggle();
    await click(q('[data-testid=blocked-on]'));
    await settle(300);
    await press('Escape');
    await settle(300);
    expect(q('[data-testid=blocker-picker]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pressing Blocked again when it is already on does not ask again', async () => {
    toggle({ blocked: true, blockers: [a] });
    await click(q('[data-testid=blocked-on]'));
    await settle(250);
    expect(q('[data-testid=blocker-picker]')).toBeNull();
  });

  it('Not blocked clears every blocker at once', async () => {
    const onChange = toggle({ blocked: true, blockers: [a, b] });
    await click(q('[data-testid=blocked-off]'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('one blocker shows as a card; two or more show as boxes with a cross each', async () => {
    toggle({ blocked: true, blockers: [a] });
    expect(q('[data-testid=blocked-by]')!.textContent).toContain('LIRA-101');
    expect(q('[data-testid=blocker-chips]')).toBeNull();
    cleanup();
    toggle({ blocked: true, blockers: [a, b] });
    expect(qa('[data-testid=blocker-chips] li')).toHaveLength(2);
  });

  it('the cross removes one ticket; removing the last one switches it off', async () => {
    const onChange = toggle({ blocked: true, blockers: [a, b] });
    await click(q('[aria-label="Remove LIRA-101"]'));
    expect(onChange).toHaveBeenLastCalledWith([102]);
    cleanup();
    const onChange2 = toggle({ blocked: true, blockers: [a] });
    await click(q('[aria-label="Remove LIRA-101"]'));
    expect(onChange2).toHaveBeenCalledWith([]);
  });

  it('"Add" opens the picker without the tickets already linked', async () => {
    toggle({ blocked: true, blockers: [a] });
    await click(q('[data-testid=blocked-add]'));
    await settle(300);
    const keys = qa('[data-testid^="blocker-LIRA-"]').map(e => e.getAttribute('data-testid'));
    expect(keys).not.toContain('blocker-LIRA-101');
    expect(keys).toContain('blocker-LIRA-102');
  });

  it('a ticket that blocks others lists them under "This ticket is blocking"', () => {
    toggle({ blocking: [b] });
    expect(q('[data-testid=blocking-list]')!.textContent).toContain('LIRA-102');
    cleanup();
    toggle();
    expect(q('[data-testid=blocking-list]')).toBeNull();
  });

  it('a blocker can be opened from the list', async () => {
    const onOpenIssue = vi.fn();
    toggle({ blocked: true, blockers: [a], onOpenIssue });
    await click(q('[data-testid=blocked-by] button[title^="Open"]'));
    expect(onOpenIssue).toHaveBeenCalledWith(a);
  });
});
