import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, mount, q } from '../../test/render';
import { currentSprintKey } from '../../utils/sprintUtils';
import { useCreateIssueFields } from './useCreateIssueFields';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 10, 10)); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function Probe() {
  const f = useCreateIssueFields('inprogress');
  return (
    <div>
      <span data-testid="s">{JSON.stringify({ title: f.title, type: f.type, status: f.status, parentId: f.parentId ?? null, priority: f.priority, due: f.dueDate, labels: f.labels, sprint: f.sprint, error: f.error, atts: f.attachments.length, desc: f.description })}</span>
      <button data-testid="fill" onClick={() => { f.setTitle('T'); f.setDescription('D'); f.setAttachments([{} as never]); f.setType('bug'); f.setStatus('done'); f.setParentId(4); f.setPriority('high'); f.setDueDate('2026-12-01'); f.setLabels('a'); f.setSprint('2027-01'); f.setError('oops'); }} />
      <button data-testid="clear" onClick={f.clearFields} />
    </div>
  );
}
const state = () => JSON.parse(q('[data-testid="s"]')!.textContent!);

describe('useCreateIssueFields', () => {
  it('starts empty, as a medium task in the current sprint with the given status', () => {
    mount(<Probe />);
    expect(state()).toEqual({ title: '', type: 'task', status: 'inprogress', parentId: null, priority: 'medium', due: '', labels: '', sprint: currentSprintKey(), error: '', atts: 0, desc: '' });
  });
  it('clears what was typed but keeps the status', async () => {
    mount(<Probe />);
    await click(q('[data-testid="fill"]'));
    expect(state()).toMatchObject({ title: 'T', type: 'bug', status: 'done', parentId: 4, error: 'oops', atts: 1 });
    await click(q('[data-testid="clear"]'));
    expect(state()).toEqual({ title: '', type: 'task', status: 'done', parentId: null, priority: 'medium', due: '', labels: '', sprint: currentSprintKey(), error: '', atts: 0, desc: '' });
  });
});
