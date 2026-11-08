import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './types';
import type { AgentContext } from './context';
import { moveIssuesToSprint, allSprintKeys, currentSprintKey, sprintName, sprintLabel } from '../../utils/sprintUtils';
import { planSprintFromBacklog, riskRadarText, sprintSummaryText, standupDigestText, type SprintPlan } from './sprintInsights';

// Sprint-aware answers: plan a sprint from the backlog, summarise one, write a standup, show what is at risk.

const reply = (c: AgentContext, text: string, suggestedActions: string[], extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: uuidv4(), sender: 'assistant', text, timestamp: c.now, refinedPrompt: c.refinedMetadata, suggestedActions, ...extra,
});

/** What the plan would do, as text. Used by the preview and by the result. */
export function describePlan(plan: SprintPlan): string {
  const src = { set: 'the capacity you set', history: 'the average of recent closed sprints', default: 'a default (no capacity set yet)' }[plan.capacitySource];
  const lines = [`**${sprintName(plan.target)}**: capacity ${plan.capacity} points (${src}), ${plan.alreadyPoints} already planned.`, ''];
  plan.picked.forEach(i => lines.push(`- **${i.key}** ${i.title} — ${i.priority}, ${typeof i.storyPoints === 'number' ? `${i.storyPoints} pts` : 'not estimated (counted as 3)'}`));
  lines.push('', `**${plan.picked.length}** ticket${plan.picked.length === 1 ? '' : 's'}, ${plan.pickedPoints} points.`);
  if (plan.skipped.length) lines.push(`${plan.skipped.length} more did not fit: ${plan.skipped.slice(0, 5).map(i => i.key).join(', ')}${plan.skipped.length > 5 ? '…' : ''}`);
  return lines.join('\n');
}

export async function handleSprintPlan(c: AgentContext): Promise<ChatMessage | undefined> {
  const g = c.refinedGoal;
  if (g.intent !== 'sprint_plan' || !g.targetSprint) return undefined;
  const plan = planSprintFromBacklog(c.allIssues, g.targetSprint, g.targetSpace?.id);
  if (!plan.picked.length) {
    return reply(c, `Nothing from the backlog fits **${sprintName(g.targetSprint)}**${plan.skipped.length ? ` (${plan.skipped.length} tickets are too big for the remaining capacity of ${Math.max(0, plan.capacity - plan.alreadyPoints)} points)` : ' (the backlog is empty, or those spaces are not in this sprint)'}.`,
      ['Show the risk radar', 'Summarise this sprint']);
  }
  const moved = await moveIssuesToSprint(plan.picked, g.targetSprint);
  return reply(c, `**Planned ${sprintName(g.targetSprint)}**: moved ${moved} backlog ticket${moved === 1 ? '' : 's'} in.\n\n${describePlan(plan)}`,
    [`Summarise ${g.targetSprint === currentSprintKey() ? 'this' : 'next'} sprint`, 'Show the risk radar'], { actionTaken: { type: 'sprint_plan', details: `Moved ${moved} tickets to ${sprintName(g.targetSprint)}` } });
}

export async function handleSprintSummary(c: AgentContext): Promise<ChatMessage | undefined> {
  const g = c.refinedGoal;
  if (g.intent !== 'sprint_summary' || !g.targetSprint) return undefined;
  return reply(c, sprintSummaryText(c.allIssues, g.targetSprint, c.allSpaces), ['Show the risk radar', 'Write my standup', 'Plan next sprint from my backlog'], { actionTaken: { type: 'summary', details: `Summary of ${sprintLabel(g.targetSprint)}` } });
}

export async function handleStandupDigest(c: AgentContext): Promise<ChatMessage | undefined> {
  if (c.refinedGoal.intent !== 'standup_digest') return undefined;
  return reply(c, standupDigestText(c.allIssues, c.allSpaces, c.now), ['Show the risk radar', 'Summarise this sprint'], { actionTaken: { type: 'summary', details: 'Standup digest' } });
}

export async function handleRiskRadar(c: AgentContext): Promise<ChatMessage | undefined> {
  if (c.refinedGoal.intent !== 'risk_radar') return undefined;
  return reply(c, riskRadarText(c.allIssues, allSprintKeys(c.allIssues), c.allSpaces, c.now), ['Summarise this sprint', 'Plan next sprint from my backlog'], { actionTaken: { type: 'summary', details: 'Risk radar' } });
}
