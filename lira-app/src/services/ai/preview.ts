import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './types';
import type { AgentContext } from './context';
import { generateDomainSubtasks } from './subtasks';
import { describePlan } from './handlersSprint';
import { planSprintFromBacklog } from './sprintInsights';
import { sprintName } from '../../utils/sprintUtils';
import { suggestForTicket } from './suggest';

/** Intents that change data. With "confirm writes" on, these are explained first and only run after Confirm. */
export const WRITE_INTENTS = ['create_issue', 'status_transition', 'subtask_breakdown', 'sprint_plan'];

type Goal = AgentContext['refinedGoal'];

/** What each kind of write would do, in words. Returns undefined when the request is not clear enough to preview. */
const EXPLAIN: Record<string, (c: AgentContext, g: Goal) => string | undefined> = {
  status_transition: (_c, g) => {
    if (!g.targetTicket || !g.targetStatus) return undefined;
    const t = g.targetTicket;
    let body = `Move **${t.key}** (*${t.title}*)\n- from **${(t.status || '').toUpperCase()}** to **${g.targetStatus.toUpperCase()}**`;
    if (t.status?.toLowerCase() === g.targetStatus) body += '\n\n_It is already there, so nothing would change._';
    return body;
  },
  subtask_breakdown: (_c, g) => {
    if (!g.targetTicket) return undefined;
    const subs = generateDomainSubtasks(g.targetTicket.title);
    return `Add **${subs.length}** subtasks to **${g.targetTicket.key}** (*${g.targetTicket.title}*):\n${subs.map(s => `- [ ] ${s.title}`).join('\n')}`;
  },
  create_issue: (c, g) => {
    if (!g.newIssueTitle) return undefined;
    const space = g.targetSpace || c.activeSpace || c.allSpaces[0];
    const type = (g.newIssueType || 'task').toLowerCase();
    let body = `Create a **${type}** "${g.newIssueTitle}" in **${space?.name ?? 'the workspace'}**`;
    const s = suggestForTicket(g.newIssueTitle, '', type, c.allIssues, space?.id);
    if (s.duplicates.length) body += `\n\n**Possible duplicate${s.duplicates.length > 1 ? 's' : ''}:**\n${s.duplicates.map(d => `- **${d.issue.key}** ${d.issue.title} (${Math.round(d.score * 100)}% similar, ${d.issue.status})`).join('\n')}`;
    if (s.epic) body += `\n\nLikely epic: **${s.epic.key}** ${s.epic.title}`;
    return body;
  },
  sprint_plan: (c, g) => {
    if (!g.targetSprint) return undefined;
    const plan = planSprintFromBacklog(c.allIssues, g.targetSprint, g.targetSpace?.id);
    if (!plan.picked.length) return undefined; // the handler explains why nothing fits
    return `Fill **${sprintName(g.targetSprint)}** from the backlog:\n\n${describePlan(plan)}`;
  },
};

/**
 * Explains what a write would do without doing it. Returns undefined when the request is not clear enough
 * to preview (for example, the ticket does not exist); the normal handler then explains the problem.
 */
export function buildPreview(c: AgentContext): ChatMessage | undefined {
  const g = c.refinedGoal;
  const body = Object.hasOwn(EXPLAIN, g.intent) ? EXPLAIN[g.intent](c, g) : undefined;
  if (!body) return undefined;

  return {
    id: uuidv4(),
    sender: 'assistant',
    text: `**Please confirm.** I have not changed anything yet.\n\n${body}`,
    timestamp: c.now,
    refinedPrompt: c.refinedMetadata,
    pending: { prompt: c.userPrompt, state: 'waiting' },
    actionTaken: { type: 'preview', details: g.optimizedGoal },
  };
}
