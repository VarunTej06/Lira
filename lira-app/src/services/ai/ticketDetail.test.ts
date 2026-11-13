import { describe, expect, it, vi } from 'vitest';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import type { AgentContext } from './context';

vi.mock('../../hooks/useIssues', () => ({ createIssue: vi.fn(), updateIssue: vi.fn(), getNextIssueKey: vi.fn() }));

import { handleTicketDetail } from './handlersWrite';

const space = { id: 1, key: 'AAA', name: 'Alpha', icon: 'A' } as Space;
const ticket = (over: Partial<Issue> = {}) => ({ id: 1, key: 'AAA-1', title: 'Fix login', type: 'bug', priority: 'high', status: 'todo', spaceId: 1, assignee: 'Varun', reporter: 'Bob', subtasks: [], ...over }) as unknown as Issue;

async function textFor(t: Issue, sp: Space | null = space) {
  const ctx = { now: new Date(0), spacesMap: new Map(sp ? [[1, sp]] : []), refinedGoal: { intent: 'ticket_detail', targetTicket: t, targetSpace: undefined }, refinedMetadata: undefined } as unknown as AgentContext;
  const msg = await handleTicketDetail(ctx);
  return msg!.text;
}

describe('ticket detail text', () => {
  it('has the heading, then one line each for title, space, type and priority, status and people', async () => {
    expect(await textFor(ticket())).toBe(
      '### Ticket Details: **AAA-1**\n\n'
      + '- **Title**: Fix login\n'
      + '- **Space**: **Alpha** (`AAA`)\n'
      + '- **Type**: `BUG` | **Priority**: `HIGH`\n'
      + '- **Status**: **TODO**\n'
      + '- **Assignee**: Varun | **Reporter**: Bob\n',
    );
  });
  it('has fallbacks for a missing space, assignee and reporter', async () => {
    const text = await textFor(ticket({ assignee: '', reporter: '' } as never), null);
    expect(text).toContain('- **Space**: **Unknown** (`?`)');
    expect(text).toContain('- **Assignee**: Unassigned | **Reporter**: VY');
  });
  it('adds the due date and the parent epic only when there are some', async () => {
    const text = await textFor(ticket({ dueDate: new Date(2026, 10, 20) as never, epicLink: 'Big epic' } as never));
    expect(text).toContain(`- **Due Date**: ${new Date(2026, 10, 20).toLocaleDateString()}\n`);
    expect(text).toContain('- **Parent Epic**: **Big epic**\n');
    expect(await textFor(ticket())).not.toMatch(/Due Date|Parent Epic/);
  });
  it('shows subtask progress as done of total and a percent', async () => {
    const text = await textFor(ticket({ subtasks: [{ completed: true }, { completed: false }, { completed: false }, { completed: false }] } as never));
    expect(text).toContain('- **Subtasks**: 1/4 completed (25%)\n');
    expect(await textFor(ticket())).not.toContain('Subtasks');
  });
  it('quotes the first four lines of the description', async () => {
    const text = await textFor(ticket({ description: 'l1\nl2\nl3\nl4\nl5' }));
    expect(text.endsWith('\n**Description Preview:**\n> l1\n> l2\n> l3\n> l4\n')).toBe(true);
    expect(text).not.toContain('l5');
  });
  it('has no preview without a description', async () => {
    expect(await textFor(ticket())).not.toContain('Description Preview');
  });
});
