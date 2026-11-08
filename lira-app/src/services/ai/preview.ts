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

/**
 * Explains what a write would do without doing it. Returns undefined when the request is not clear enough
 * to preview (for example, the ticket does not exist); the normal handler then explains the problem.
 */
export function buildPreview(c: AgentContext): ChatMessage | undefined {
  const g = c.refinedGoal;
  let body: string | undefined;

  if (g.intent === 'status_transition' && g.targetTicket && g.targetStatus) {
    const t = g.targetTicket;
    body = `Move **${t.key}** (*${t.title}*)\n- from **${(t.status || '').toUpperCase()}** to **${g.targetStatus.toUpperCase()}**`;
    if (t.status?.toLowerCase() === g.targetStatus) body += '\n\n_It is already there, so nothing would change._';
  } else if (g.intent === 'subtask_breakdown' && g.targetTicket) {
    const subs = generateDomainSubtasks(g.targetTicket.title);
    body = `Add **${subs.length}** subtasks to **${g.targetTicket.key}** (*${g.targetTicket.title}*):\n${subs.map(s => `- [ ] ${s.title}`).join('\n')}`;
  } else if (g.intent === 'create_issue' && g.newIssueTitle) {
    const space = g.targetSpace || c.activeSpace || c.allSpaces[0];
    const type = (g.newIssueType || 'task').toLowerCase();
    body = `Create a **${type}** "${g.newIssueTitle}" in **${space?.name ?? 'the workspace'}**`;
    const s = suggestForTicket(g.newIssueTitle, '', type, c.allIssues, space?.id);
    if (s.duplicates.length) body += `\n\n**Possible duplicate${s.duplicates.length > 1 ? 's' : ''}:**\n${s.duplicates.map(d => `- **${d.issue.key}** ${d.issue.title} (${Math.round(d.score * 100)}% similar, ${d.issue.status})`).join('\n')}`;
    if (s.epic) body += `\n\nLikely epic: **${s.epic.key}** ${s.epic.title}`;
  } else if (g.intent === 'sprint_plan' && g.targetSprint) {
    const plan = planSprintFromBacklog(c.allIssues, g.targetSprint, g.targetSpace?.id);
    if (!plan.picked.length) return undefined; // the handler explains why nothing fits
    body = `Fill **${sprintName(g.targetSprint)}** from the backlog:\n\n${describePlan(plan)}`;
  }
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
