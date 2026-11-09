import { describe, expect, it } from 'vitest';
import { refineUserPrompt } from './intent';
import { makeIssue, makeSpace } from '../../test/factories';

/**
 * What Lira understands from sixty typical requests: the kind of request, the status, ticket, space, and (for creating) the type and title.
 * These answers were recorded from the original, single-function parser, so splitting it into steps changed nothing.
 */
const spaces = [makeSpace({ id: 1, key: 'LIRA', name: 'Lira' }), makeSpace({ id: 2, key: 'AP', name: 'Atmos - Weather App' }), makeSpace({ id: 3, key: 'CERT', name: 'Certifications' }), makeSpace({ id: 4, key: 'IG', name: 'Interview Guide' })];
const issues = [makeIssue({ id: 1, key: 'LIRA-2', spaceId: 1, title: 'Board' }), makeIssue({ id: 2, key: 'AP-10', spaceId: 2, title: 'Forecast' })];

// [request, intent, status, ticket, space, new ticket type, new ticket title]
const CASES: [string, string, string | null, string | null, string | null, string | null, string | null][] = [
  ["move AP-10 to done","status_transition","done","AP-10","AP",null,null],
  ["mark lira 2 as in progress","status_transition","inprogress","LIRA-2","LIRA",null,null],
  ["set LIRA-2 to todo","status_transition","todo","LIRA-2","LIRA",null,null],
  ["put ap10 in backlog","status_transition","backlog","AP-10","AP",null,null],
  ["complete AP-10","status_transition","done","AP-10","AP",null,null],
  ["what is in progress","status_query","inprogress",null,null,null,null],
  ["show done tickets","status_query","done",null,null,null,null],
  ["show todo","status_query","todo",null,null,null,null],
  ["backlog items","status_query","backlog",null,null,null,null],
  ["priority breakdown","priority_breakdown",null,null,null,null,null],
  ["by priority","priority_breakdown",null,null,null,null,null],
  ["generate subtasks for LIRA-2","subtask_breakdown",null,"LIRA-2","LIRA",null,null],
  ["break down AP-10","subtask_breakdown",null,"AP-10","AP",null,null],
  ["split lira-2","subtask_breakdown",null,"LIRA-2","LIRA",null,null],
  ["breakdown","subtask_breakdown",null,null,"LIRA",null,null],
  ["status breakdown","matrix",null,null,null,null,null],
  ["tickets in each space by status","matrix",null,null,null,null,null],
  ["show all spaces with number of tickets in each To do, Backlog, In Progress and Done","matrix",null,null,null,null,null],
  ["create a task \"Review goals\" in Lira","create_issue",null,null,"LIRA","task","review goals"],
  ["add bug login fails in Atmos","create_issue",null,null,"AP","bug","login fails"],
  ["new epic Payments for Certifications","space_query",null,null,"CERT",null,null],
  ["create task: write docs","create_issue",null,null,"LIRA","task","write docs"],
  ["add epic","create_issue",null,null,"LIRA","task","epic"],
  ["LIRA-2","ticket_detail",null,"LIRA-2","LIRA",null,null],
  ["tell me about AP-10","ticket_detail",null,"AP-10","AP",null,null],
  ["show Atmos","space_query",null,null,"AP",null,null],
  ["what is in progress in Lira","space_query","inprogress",null,"LIRA",null,null],
  ["done in certifications","space_query","done",null,"CERT",null,null],
  ["Interview Guide backlog","space_query","backlog",null,"IG",null,null],
  ["show all epics","epics_list",null,null,null,null,null],
  ["epics","epics_list",null,null,null,null,null],
  ["find billing","search",null,null,null,null,null],
  ["search login bug","search",null,null,null,null,null],
  ["hello","overview",null,null,null,null,null],
  ["hi","overview",null,null,null,null,null],
  ["what","overview",null,null,null,null,null],
  ["help me","search",null,null,null,null,null],
  ["plan next sprint from my backlog","sprint_plan",null,null,null,null,null],
  ["plan the sprint","sprint_plan",null,null,null,null,null],
  ["write my standup","standup_digest",null,null,null,null,null],
  ["standup","standup_digest",null,null,null,null,null],
  ["show the risk radar","risk_radar",null,null,null,null,null],
  ["risk","risk_radar",null,null,null,null,null],
  ["stale tickets","risk_radar",null,null,null,null,null],
  ["summarise this sprint","sprint_summary",null,null,null,null,null],
  ["how is last sprint","sprint_summary",null,null,null,null,null],
  ["recap sprint","sprint_summary",null,null,null,null,null],
  ["build a dashboard of blocked work","dashboard_build",null,null,null,null,null],
  ["create a dashboard for sprint health","dashboard_build",null,null,null,null,null],
  ["overview","search",null,null,null,null,null],
  ["what can you do","search",null,null,null,null,null],
  ["show everything","search",null,null,null,null,null],
  ["working on","status_query","inprogress",null,null,null,null],
  ["ongoing work","status_query","inprogress",null,null,null,null],
  ["finished tickets","status_query","done",null,null,null,null],
  ["to done","status_query","done",null,null,null,null],
  ["move it to done","status_query","done",null,null,null,null],
  ["matrix","matrix",null,null,null,null,null],
  ["status of all spaces","matrix",null,null,null,null,null],
  ["xyz","overview",null,null,null,null,null],
  ["abcd efgh","search",null,null,null,null,null],
  ["move AP-99 to done","status_transition","done","AP-99","AP",null,null],
  ["create a bug","create_issue",null,null,"LIRA","task","bug"],
  ["add task Fix it in the Lira space with high priority","create_issue",null,null,"LIRA","task","fix it"],
];

describe('Understanding requests', () => {
  it.each(CASES)('%s', (request, intent, status, ticket, space, type, title) => {
    const g = refineUserPrompt(request, spaces, issues, spaces[0]);
    expect([g.intent, g.targetStatus ?? null, g.targetTicketKey ?? null, g.targetSpace?.key ?? null, g.newIssueType ?? null, g.newIssueTitle ?? null]).toEqual([intent, status, ticket, space, type, title]);
  });
});
