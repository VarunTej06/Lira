import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './types';
import type { AgentContext } from './context';
import { planFromPrompt } from '../../utils/dashboards/promptBuilder';
import { addDashboard, buildDashboard } from '../../utils/dashboards/store';
import { entryById } from '../../utils/dashboards/catalog';

/**
 * "Build me a dashboard of what is blocked in this sprint and who is overloaded."
 * Creates the dashboard (only the dashboard: no ticket is touched), and the chat offers a button to open it.
 */
export async function handleDashboardBuild(c: AgentContext): Promise<ChatMessage | undefined> {
  if (c.refinedGoal.intent !== 'dashboard_build') return undefined;
  const plan = planFromPrompt(c.userPrompt, c.allSpaces);
  const d = addDashboard(buildDashboard({ name: plan.name, scenario: plan.scenario, filters: plan.filters, entryIds: plan.entries }));
  const widgets = plan.entries.map(id => entryById(id)?.title).filter(Boolean).join(', ');
  const text = [`**Created the dashboard "${d.name}"** with ${d.widgets.length} widgets.`, '', ...plan.understood.map(u => `- ${u}`), '', `Widgets: ${widgets}.`, '', 'Open it to rearrange, resize, change filters or add alerts.'].join('\n');
  return {
    id: uuidv4(), sender: 'assistant', text, timestamp: c.now, refinedPrompt: c.refinedMetadata,
    actionTaken: { type: 'dashboard', dashboardId: d.id, details: `Created dashboard ${d.name}` },
    suggestedActions: ['Show what is blocked', 'Plan next sprint from my backlog'],
  };
}
