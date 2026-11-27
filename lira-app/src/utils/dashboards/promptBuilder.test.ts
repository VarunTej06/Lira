import { describe, expect, it } from 'vitest';
import { makeSpace } from '../../test/factories';
import { isDashboardRequest, planFromPrompt } from './promptBuilder';

describe('knowing a dashboard is asked for', () => {
  it('needs both the word dashboard and a verb that asks for one', () => {
    expect(isDashboardRequest('Create a dashboard for bugs')).toBe(true);
    expect(isDashboardRequest('I want a new dashboard')).toBe(true);
    expect(isDashboardRequest('create a ticket')).toBe(false);
    expect(isDashboardRequest('my dashboard is slow')).toBe(false);
  });
});

describe('planning a dashboard from a sentence', () => {
  it('finds the topic, the widgets and the scenario', () => {
    const p = planFromPrompt('what is blocked and overdue');
    expect(p.entries).toEqual(expect.arrayContaining(['stat-blocked', 'blocked', 'stat-overdue']));
    expect(p.scenario).toBe('blocked-risks');
    expect(p.understood[0]).toMatch(/^Topics: Blocked work, Overdue/);
  });
  it('adds the open and finished counts when the topic gives fewer than four widgets', () => {
    expect(planFromPrompt('roadmap').entries).toEqual(['stat-done-week', 'stat-open', 'roadmap']);
  });
  it('narrows by sprint, bugs and priority, and says so', () => {
    const p = planFromPrompt('urgent bugs in the sprint');
    expect(p.filters).toMatchObject({ sprint: 'current', types: ['bug'], priorities: ['highest', 'high'] });
    expect(p.understood).toEqual(expect.arrayContaining(['Limited to the current sprint.', 'Only bugs.', 'Only high priority work.']));
    expect(p.name).toContain('(this sprint)');
  });
  it('makes it personal for "my", but not when the team is meant', () => {
    const p = planFromPrompt('my overdue work');
    expect(p.filters.assignee).toBe('me');
    expect(p.scenario).toBe('my-work');
    expect(p.name.startsWith('My ')).toBe(true);
    expect(planFromPrompt('what is the team overdue on').filters.assignee).toBe('all');
  });
  it('limits the time of finished work', () => {
    expect(planFromPrompt('done this week').filters.range).toBe('7d');
    expect(planFromPrompt('shipped this month').filters.range).toBe('30d');
    expect(planFromPrompt('completed in the quarter').filters.range).toBe('90d');
  });
  it('limits it to a space named in the sentence, unless all spaces are asked for', () => {
    const spaces = [makeSpace({ id: 7, name: 'Payments', key: 'PAY' })];
    expect(planFromPrompt('blocked work in Payments', spaces).filters.spaceIds).toEqual([7]);
    expect(planFromPrompt('blocked work in Payments across all spaces', spaces).filters.spaceIds).toEqual([]);
  });
  it('falls back to an overview and says it did not understand', () => {
    const p = planFromPrompt('hello');
    expect(p.scenario).toBe('executive');
    expect(p.name).toBe('Overview');
    expect(p.understood.join(' ')).toContain('did not recognise');
  });
  it('is the same every time for the same sentence', () => {
    expect(planFromPrompt('bugs and workload')).toEqual(planFromPrompt('bugs and workload'));
  });
});
