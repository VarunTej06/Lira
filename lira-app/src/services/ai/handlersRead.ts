import { descriptionToText } from '../../utils/richText';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from './types';
import type { AgentContext } from './context';

// Handlers that only read: status matrix, priority breakdown, space and epic lists, status queries and keyword search.

/**
 * E. CROSS-SPACE STATUS BREAKDOWN MATRIX
 */
export async function handleStatusMatrix(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, allSpaces, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'matrix') {
    let text = `### **Workspace Status Breakdown Across All Spaces** (${allSpaces.length} Spaces, ${allIssues.length} Tickets)\n\n`;
    text += `| Space | Key | Backlog | To Do | In Progress | Done | Total |\n|---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

    let totalBacklog = 0;
    let totalTodo = 0;
    let totalInprogress = 0;
    let totalDone = 0;

    allSpaces.forEach(s => {
      const issues = allIssues.filter(i => i.spaceId === s.id);
      const b = issues.filter(i => i.status === 'backlog').length;
      const td = issues.filter(i => i.status === 'todo').length;
      const ip = issues.filter(i => i.status === 'inprogress').length;
      const d = issues.filter(i => i.status === 'done').length;

      totalBacklog += b;
      totalTodo += td;
      totalInprogress += ip;
      totalDone += d;

      text += `| ${s.icon} **${s.name}** | \`${s.key}\` | ${b} | ${td} | ${ip} | ${d} | **${issues.length}** |\n`;
    });

    text += `| **Workspace Total** | — | **${totalBacklog}** | **${totalTodo}** | **${totalInprogress}** | **${totalDone}** | **${allIssues.length}** |\n`;

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        details: 'Cross-space status breakdown matrix',
      },
      suggestedActions: [
        'What is in progress across all spaces?',
        'Show all Epics across spaces',
        'Show tickets in Atmos',
      ],
    };
  }

  return undefined;
}

/**
 * F. PRIORITY DISTRIBUTION BREAKDOWN
 */
export async function handlePriorityBreakdown(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, allSpaces, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'priority_breakdown') {
    let text = `### **Priority Distribution Across All Spaces** (${allIssues.length} Tickets)\n\n`;
    text += `| Space | Key | Highest | High | Medium | Low | Total |\n|---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;

    allSpaces.forEach(s => {
      const issues = allIssues.filter(i => i.spaceId === s.id);
      const highest = issues.filter(i => i.priority === 'highest').length;
      const high = issues.filter(i => i.priority === 'high').length;
      const medium = issues.filter(i => i.priority === 'medium').length;
      const low = issues.filter(i => i.priority === 'low' || i.priority === 'lowest').length;
      text += `| ${s.icon} **${s.name}** | \`${s.key}\` | ${highest} | ${high} | ${medium} | ${low} | **${issues.length}** |\n`;
    });

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      suggestedActions: ['Show status breakdown of all spaces', 'What is in progress across all spaces?'],
    };
  }

  return undefined;
}

/**
 * G. SPECIFIC SPACE QUERY
 */
export async function handleSpaceQuery(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'space_query' && refinedGoal.targetSpace) {
    const spaceToQuery = refinedGoal.targetSpace;
    const spaceIssues = allIssues.filter(i => i.spaceId === spaceToQuery.id);

    if (refinedGoal.targetStatus) {
      const statusFilter = refinedGoal.targetStatus;
      const filtered = spaceIssues.filter(i => i.status === statusFilter);
      if (filtered.length === 0) {
        return {
          id: uuidv4(),
          sender: 'assistant',
          text: `In **${spaceToQuery.icon} ${spaceToQuery.name}**, there are currently **0 tickets** in **${statusFilter.toUpperCase()}**.\n\nTotal tickets in this space: **${spaceIssues.length}**.`,
          timestamp: now,
          refinedPrompt: refinedMetadata,
          suggestedActions: [
            `Show all tickets in ${spaceToQuery.name}`,
            `What is in progress in ${spaceToQuery.name}?`,
            `Workspace overview`,
          ],
        };
      }

      const list = filtered.map(i => `- **${i.key}** [${i.type}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`).join('\n');
      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### ${spaceToQuery.icon} **${spaceToQuery.name}** — ${statusFilter.toUpperCase()} (${filtered.length} items):\n\n${list}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: [
          `Show all tickets in ${spaceToQuery.name}`,
          filtered.length > 0 ? `Tell me about ${filtered[0].key}` : 'Workspace overview',
          'What is in progress across all spaces?',
        ],
      };
    }

    // Full Space Overview
    const byStatus = {
      backlog: spaceIssues.filter(i => i.status === 'backlog'),
      todo: spaceIssues.filter(i => i.status === 'todo'),
      inprogress: spaceIssues.filter(i => i.status === 'inprogress'),
      done: spaceIssues.filter(i => i.status === 'done'),
    };

    let text = `### ${spaceToQuery.icon} **${spaceToQuery.name}** (\`${spaceToQuery.key}\`) — ${spaceIssues.length} Total Tickets:\n\n`;
    text += `| Column | Count | Tickets |\n|---|:---:|---|\n`;
    text += `| **Backlog** | ${byStatus.backlog.length} | ${byStatus.backlog.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| **To Do** | ${byStatus.todo.length} | ${byStatus.todo.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| **In Progress** | ${byStatus.inprogress.length} | ${byStatus.inprogress.map(i => `\`${i.key}\``).join(', ') || '—'} |\n`;
    text += `| **Done** | ${byStatus.done.length} | ${byStatus.done.map(i => `\`${i.key}\``).join(', ') || '—'} |\n\n`;

    if (spaceIssues.length > 0) {
      text += `**Sample tickets in this space:**\n`;
      spaceIssues.slice(0, 5).forEach(i => {
        text += `- **${i.key}** [${i.status.toUpperCase()}]: ${i.title}\n`;
      });
    }

    return {
      id: uuidv4(),
      sender: 'assistant',
      text,
      timestamp: now,
      refinedPrompt: refinedMetadata,
      actionTaken: {
        type: 'summary',
        details: `${spaceToQuery.name} summary`,
      },
      suggestedActions: [
        `What is in progress in ${spaceToQuery.name}?`,
        `Create task in ${spaceToQuery.name}`,
        'Show all spaces overview',
      ],
    };
  }

  return undefined;
}

/**
 * H. EPICS LIST ACROSS ALL SPACES
 */
export async function handleEpicsList(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'epics_list') {
    const allEpics = allIssues.filter(i => i.type === 'epic');
    if (allEpics.length > 0) {
      let text = `### **All Epics Across Workspace (${allEpics.length} Epics):**\n\n`;
      allEpics.forEach(e => {
        const space = spacesMap.get(e.spaceId);
        const children = allIssues.filter(i => i.parentId === e.id || i.epicId === e.id);
        const doneChildren = children.filter(c => c.status === 'done').length;
        text += `- **${e.key}**: **${e.title}**\n`;
        text += `  - Space: ${space?.icon} **${space?.name}** | Status: **${e.status.toUpperCase()}** | Priority: \`${e.priority}\`\n`;
        text += `  - Progress: ${doneChildren}/${children.length} tasks completed\n`;
      });

      return {
        id: uuidv4(),
        sender: 'assistant',
        text,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: allEpics.map(e => `Tell me about ${e.key}`),
      };
    }
  }

  return undefined;
}

/**
 * I. STATUS QUERY ACROSS ALL SPACES (In Progress, Done, To Do, Backlog)
 */
export async function handleStatusQuery(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'status_query') {
    const targetStatus = refinedGoal.targetStatus || 'inprogress';

    if (targetStatus === 'inprogress') {
      const inProgress = allIssues.filter(i => i.status === 'inprogress');
      if (inProgress.length === 0) {
        return {
          id: uuidv4(),
          sender: 'assistant',
          text: `Currently, there are **0 tasks in progress** across the entire workspace.\n\nReady to pull work from **To Do**!`,
          timestamp: now,
          refinedPrompt: refinedMetadata,
          suggestedActions: ['Show tasks in To Do', 'Workspace overview'],
        };
      }

      const items = inProgress.map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### **Currently In Progress Across All Spaces (${inProgress.length} items):**\n\n${items}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: inProgress.slice(0, 3).map(i => `Tell me about ${i.key}`),
      };
    }

    if (targetStatus === 'done') {
      const doneItems = allIssues.filter(i => i.status === 'done');
      const items = doneItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}**`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### **Completed Deliverables (${doneItems.length} items in Done):**\n\n${items}${doneItems.length > 10 ? `\n- *...and ${doneItems.length - 10} more completed items across spaces.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in progress?', 'Show status breakdown of all spaces'],
      };
    }

    if (targetStatus === 'todo') {
      const todoItems = allIssues.filter(i => i.status === 'todo');
      const items = todoItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\` | Assignee: ${i.assignee || 'Unassigned'})`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### **Items in To Do Across All Spaces (${todoItems.length} items):**\n\n${items}${todoItems.length > 10 ? `\n- *...and ${todoItems.length - 10} more items in To Do.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in progress?', 'Show status breakdown of all spaces'],
      };
    }

    if (targetStatus === 'backlog') {
      const backlogItems = allIssues.filter(i => i.status === 'backlog');
      const items = backlogItems.slice(0, 10).map(i => {
        const space = spacesMap.get(i.spaceId);
        return `- **${i.key}** [${space?.name || 'Workspace'}]: **${i.title}** (Priority: \`${i.priority}\`)`;
      }).join('\n');

      return {
        id: uuidv4(),
        sender: 'assistant',
        text: `### **Items in Backlog Across All Spaces (${backlogItems.length} items):**\n\n${items}${backlogItems.length > 10 ? `\n- *...and ${backlogItems.length - 10} more items in Backlog.*` : ''}`,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: ['What is in To Do?', 'What is in progress?'],
      };
    }
  }

  return undefined;
}

/**
 * J. KEYWORD SEARCH ACROSS ALL SPACES
 */
export async function handleKeywordSearch(c: AgentContext): Promise<ChatMessage | undefined> {
  const { now, allIssues, spacesMap, refinedGoal, refinedMetadata } = c;

  if (refinedGoal.intent === 'search' && refinedGoal.searchKeyword) {
    const searchTerm = refinedGoal.searchKeyword.toLowerCase();
    const matches = allIssues.filter(i =>
      i.title.toLowerCase().includes(searchTerm) ||
      descriptionToText(i.description).toLowerCase().includes(searchTerm) ||
      (i.labels && i.labels.some(l => l.toLowerCase().includes(searchTerm)))
    );

    if (matches.length > 0) {
      let text = `### **Search Results for "${refinedGoal.searchKeyword}" (${matches.length} matches across spaces):**\n\n`;
      matches.forEach(i => {
        const space = spacesMap.get(i.spaceId);
        text += `- **${i.key}** [${space?.icon} ${space?.name}]: **${i.title}** (${i.status.toUpperCase()} | \`${i.priority}\`)\n`;
      });

      return {
        id: uuidv4(),
        sender: 'assistant',
        text,
        timestamp: now,
        refinedPrompt: refinedMetadata,
        suggestedActions: matches.slice(0, 3).map(i => `Tell me about ${i.key}`),
      };
    }
  }

  return undefined;
}
