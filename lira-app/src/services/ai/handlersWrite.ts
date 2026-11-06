import { createIssue, updateIssue, getNextIssueKey } from '../../hooks/useIssues';
import { v4 as uuidv4 } from 'uuid';
import type { Issue, Priority, IssueType } from '../../types/issue';
import type { ChatMessage } from './types';
import { generateDomainSubtasks } from './subtasks';
import type { AgentContext } from './context';

// Handlers that change data or inspect one ticket: status moves, subtask breakdowns, ticket details and creating tickets.

/**
 * A. STATUS TRANSITION
 */
export async function handleStatusTransition(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'status_transition' && refinedGoal.targetTicket && refinedGoal.targetStatus) {
    const targetIssue = refinedGoal.targetTicket;
    const targetStatus = refinedGoal.targetStatus;
    if (targetIssue.id) {
      await updateIssue(targetIssue.id, {
        status: targetStatus,
        updatedAt: now,
        resolvedAt: targetStatus === 'done' ? now : undefined,
      });

      const updated = { ...targetIssue, status: targetStatus };
      const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `✅ **Updated Status**: Moved **${updated.key}** (*${updated.title}*) in **${space ? space.name : 'Workspace'}** to **${targetStatus.toUpperCase()}**.`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'updated_status',
          issue: updated,
          details: `Moved to ${targetStatus} in ${space?.name || 'Workspace'}`,
        },
        suggestedActions: [
          `Show tasks in ${space?.name || 'this space'}`,
          `What else is in progress?`,
          `Break down ${updated.key} into subtasks`,
        ],
      };
    }
  }

  return undefined;
}

/**
 * B. SUBTASK BREAKDOWN
 */
export async function handleSubtaskBreakdown(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'subtask_breakdown' && refinedGoal.targetTicket) {
    const targetIssue = refinedGoal.targetTicket;
    if (targetIssue.id) {
      const generatedSubtasks = generateDomainSubtasks(targetIssue.title);
      const existingSubtasks = Array.isArray(targetIssue.subtasks) ? targetIssue.subtasks : [];
      const updatedSubtasks = [...existingSubtasks, ...generatedSubtasks];

      await updateIssue(targetIssue.id, {
        subtasks: updatedSubtasks,
        updatedAt: now,
      });

      const updated = { ...targetIssue, subtasks: updatedSubtasks };
      const subtasksList = generatedSubtasks.map(s => `- [ ] ${s.title}`).join('\n');
      const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `🤖 **Autonomous Breakdown Complete** for **${targetIssue.key}** (*${targetIssue.title}*) in **${space?.name || 'Workspace'}**:\n\nAdded **${generatedSubtasks.length} new subtasks** directly to the ticket:\n\n${subtasksList}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'added_subtasks',
          issue: updated,
          details: `Added ${generatedSubtasks.length} subtasks to ${updated.key}`,
        },
        suggestedActions: [
          `Move ${targetIssue.key} to inprogress`,
          `Show all tasks in ${space?.name || 'this space'}`,
          `What is in progress?`,
        ],
      };
    }
  }

  return undefined;
}

/**
 * C. TICKET DETAIL INSPECTION
 */
export async function handleTicketDetail(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'ticket_detail' && refinedGoal.targetTicket) {
    const targetIssue = refinedGoal.targetTicket;
    const space = spacesMap.get(targetIssue.spaceId) || refinedGoal.targetSpace;
    const sub = targetIssue.subtasks || [];
    const completedSub = sub.filter(s => s.completed).length;

    let responseText = `### 📋 Ticket Details: **${targetIssue.key}**\n\n`;
    responseText += `- **Title**: ${targetIssue.title}\n`;
    responseText += `- **Space**: ${space?.icon || '📁'} **${space?.name || 'Unknown'}** (\`${space?.key || '?'}\`)\n`;
    responseText += `- **Type**: \`${targetIssue.type.toUpperCase()}\` | **Priority**: \`${targetIssue.priority.toUpperCase()}\`\n`;
    responseText += `- **Status**: **${targetIssue.status.toUpperCase()}**\n`;
    responseText += `- **Assignee**: ${targetIssue.assignee || 'Unassigned'} | **Reporter**: ${targetIssue.reporter || 'VY'}\n`;
    if (targetIssue.dueDate) responseText += `- **Due Date**: ${new Date(targetIssue.dueDate).toLocaleDateString()}\n`;
    if (targetIssue.epicLink) responseText += `- **Parent Epic**: ⚡ **${targetIssue.epicLink}**\n`;
    if (sub.length > 0) responseText += `- **Subtasks**: ${completedSub}/${sub.length} completed (${Math.round((completedSub / sub.length) * 100)}%)\n`;
    if (targetIssue.description) {
      const descPreview = targetIssue.description.split('\n').slice(0, 4).join('\n').trim();
      responseText += `\n**Description Preview:**\n> ${descPreview.replace(/\n/g, '\n> ')}\n`;
    }

    return {
      id: uuidv4(),
      sender: 'assistant',
      text: responseText,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        issue: targetIssue,
        details: `Viewed details of ${targetIssue.key}`,
      },
      suggestedActions: [
        `Move ${targetIssue.key} to ${targetIssue.status === 'done' ? 'inprogress' : 'done'}`,
        `Break down ${targetIssue.key} into subtasks`,
        `Show other tasks in ${space?.name || 'this space'}`,
      ],
    };
  }

  return undefined;
}

/**
 * D. CREATE NEW ISSUE WITH TARGET SPACE AWARENESS
 */
export async function handleCreateIssue(c: AgentContext): Promise<ChatMessage | undefined> {
  const { userPrompt, q, now, allSpaces, activeSpace, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'create_issue' && refinedGoal.newIssueTitle) {
    const rawType = (refinedGoal.newIssueType || 'task').toLowerCase() as IssueType;
    const title = refinedGoal.newIssueTitle;
    const spaceToUse = refinedGoal.targetSpace || activeSpace || allSpaces[0];

    if (spaceToUse && spaceToUse.id) {
      const key = await getNextIssueKey(spaceToUse.key);
      let priority: Priority = 'medium';
      if (q.includes('highest priority') || q.includes('critical') || q.includes('urgent')) priority = 'highest';
      else if (q.includes('high priority') || q.includes('important')) priority = 'high';
      else if (q.includes('low priority')) priority = 'low';

      let status = 'todo';
      if (q.includes('in progress') || q.includes('inprogress')) status = 'inprogress';
      else if (q.includes('in backlog') || q.includes('backlog')) status = 'backlog';
      else if (q.includes('done')) status = 'done';

      const newIssue: Omit<Issue, 'id'> = {
        spaceId: spaceToUse.id,
        key,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        description: `## Overview\nCreated autonomously by Viva AI Agent based on prompt:\n> "${userPrompt}"\n\n## Refined Goal\n- ${refinedGoal.optimizedGoal}\n\n## Acceptance Criteria\n- Implemented according to project specification in ${spaceToUse.name}\n- Verified on board and local storage`,
        type: rawType,
        status,
        priority,
        assignee: 'VY',
        assigneeInitials: 'VY',
        reporter: 'AI Agent',
        reporterInitials: 'AI',
        labels: ['ai-created', spaceToUse.key.toLowerCase()],
        subtasks: [
          { id: uuidv4(), title: 'Initial setup & requirements verification', completed: false, createdAt: now },
          { id: uuidv4(), title: 'Implementation & local testing', completed: false, createdAt: now },
          { id: uuidv4(), title: 'Review and promote on Kanban board', completed: false, createdAt: now },
        ],
        comments: [],
        activity: [{
          id: uuidv4(),
          type: 'created',
          author: 'AI Agent',
          authorInitials: 'AI',
          description: `created this ${rawType} in ${spaceToUse.name} via conversational AI agent command`,
          createdAt: now,
        }],
        attachments: [],
        linkedIssues: [],
        rank: Date.now(),
        storyPoints: rawType === 'epic' ? 13 : rawType === 'bug' ? 2 : 5,
        watchers: ['VY'],
        createdAt: now,
        updatedAt: now,
      };

      const id = await createIssue(newIssue);
      const created = { ...newIssue, id };

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `🎉 **Created Issue**: **${created.key}** (*${created.title}*)\n- **Space**: ${spaceToUse.icon} **${spaceToUse.name}** (\`${spaceToUse.key}\`)\n- **Type**: \`${rawType.toUpperCase()}\` | **Status**: **${status.toUpperCase()}** | **Priority**: \`${priority.toUpperCase()}\`\n- Added 3 initial subtasks automatically.`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        actionTaken: {
          type: 'created_issue',
          issue: created,
          details: `Created in ${spaceToUse.name}`,
        },
        suggestedActions: [
          `Break down ${created.key} into subtasks`,
          `Move ${created.key} to inprogress`,
          `Show all tasks in ${spaceToUse.name}`,
        ],
      };
    }
  }

  return undefined;
}
