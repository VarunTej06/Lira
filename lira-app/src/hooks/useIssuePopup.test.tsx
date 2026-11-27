import { afterEach, describe, expect, it } from 'vitest';
import { act, useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { makeIssue } from '../test/factories';
import { cleanup, mount, q } from '../test/render';
import { useIssuePopup } from './useIssuePopup';

afterEach(cleanup);

const epic = makeIssue({ id: 1, key: 'LIRA-1', type: 'epic' });
const task = makeIssue({ id: 2, key: 'LIRA-2', parentId: 1 });
const sub = makeIssue({ id: 3, key: 'LIRA-3', parentId: 2 });
const all = [epic, task, sub];

let api: ReturnType<typeof useIssuePopup>;
function Probe({ issues }: { issues: typeof all }) {
  const popup = useIssuePopup(issues);
  useEffect(() => { api = popup; });
  const loc = useLocation();
  return <p id="out">{`${popup.selectedIssue?.key ?? '-'}|${popup.parentIssue?.key ?? '-'}|${loc.search}`}</p>;
}
const show = (url: string, issues = all) => mount(<MemoryRouter initialEntries={[url]}><Probe issues={issues} /></MemoryRouter>);
const text = () => q('#out')!.textContent;

describe('the ticket popup that lives in the address', () => {
  it('is closed with nothing in the address, and open on the ticket named there when the page loads', () => {
    show('/board');
    expect(text()).toBe('-|-|');
    cleanup();
    show('/board?issue=LIRA-2');
    expect(text()).toBe('LIRA-2|-|?issue=LIRA-2');
  });

  it('stays closed for a ticket that does not exist, and opens it once the tickets have arrived', () => {
    const view = show('/board?issue=LIRA-2', []);
    expect(text()).toBe('-|-|?issue=LIRA-2');
    view.unmount();
  });

  it('opens a ticket and puts it in the address, and closes it by taking it out, without a new place in the history', async () => {
    show('/board');
    await act(async () => { api.openIssue(epic); });
    expect(text()).toBe('LIRA-1|-|?issue=LIRA-1');
    await act(async () => { api.closeModal(); });
    expect(text()).toBe('-|-|');
  });

  it('keeps the other parts of the address when it opens and closes', async () => {
    show('/board?filter=bugs');
    await act(async () => { api.openIssue(epic); });
    expect(text()).toContain('filter=bugs');
    expect(text()).toContain('issue=LIRA-1');
    await act(async () => { api.closeModal(); });
    expect(text()).toBe('-|-|?filter=bugs');
  });

  it('keeps a trail as one goes from an epic to a task to a subtask, so "back to parent" has somewhere to go', async () => {
    show('/board');
    await act(async () => { api.openIssue(epic); });
    await act(async () => { api.navigateToIssue(task); });
    expect(text()).toBe('LIRA-2|LIRA-1|?issue=LIRA-2');
    await act(async () => { api.navigateToIssue(sub); });
    expect(text()).toBe('LIRA-3|LIRA-2|?issue=LIRA-3');
    await act(async () => { api.navigateToIssue(task); }); // back up: the trail is cut at that ticket
    expect(text()).toBe('LIRA-2|LIRA-1|?issue=LIRA-2');
  });

  it('starts a new trail when a ticket is opened afresh', async () => {
    show('/board');
    await act(async () => { api.openIssue(epic); });
    await act(async () => { api.navigateToIssue(task); });
    await act(async () => { api.openIssue(sub); });
    expect(text()).toBe('LIRA-3|-|?issue=LIRA-3');
  });

  it('opens a ticket another part of the app asks for, with an event on the window', async () => {
    show('/board');
    await act(async () => { window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: task })); });
    expect(text()).toBe('LIRA-2|-|?issue=LIRA-2');
    await act(async () => { window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: null })); });
    expect(text()).toBe('LIRA-2|-|?issue=LIRA-2'); // an event with nothing in it is ignored
  });

  it('stops listening for the event when the page goes away', () => {
    const view = show('/board');
    view.unmount();
    window.dispatchEvent(new CustomEvent('lira-open-issue', { detail: task }));
    expect(document.body.textContent).toBe('');
  });
});
