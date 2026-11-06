import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actionTaken?: {
    type: 'created_issue' | 'updated_status' | 'added_subtasks' | 'summary' | 'switch_to_agent' | 'sprint_plan' | 'preview';
    issue?: Issue;
    details?: string;
  };
  suggestedActions?: string[];
  /** A change Viva has worked out but not made yet. Confirm runs `prompt`; Cancel drops it. */
  pending?: { prompt: string; state: 'waiting' | 'confirmed' | 'cancelled' };
  /** Set after a change was made; Undo puts the tickets back. */
  undo?: { id: string; changed: number; state: 'available' | 'undone' };
  refinedPrompt?: {
    originalInput: string;
    optimizedGoal: string;
    intentType: string;
    targetSpace?: string;
    targetTicketKey?: string;
  };
}

export interface RefinedPromptGoal {
  originalInput: string;
  intent:
    | 'matrix'
    | 'status_transition'
    | 'subtask_breakdown'
    | 'create_issue'
    | 'ticket_detail'
    | 'space_query'
    | 'status_query'
    | 'epics_list'
    | 'priority_breakdown'
    | 'search'
    | 'overview'
    | 'sprint_plan'
    | 'sprint_summary'
    | 'standup_digest'
    | 'risk_radar';
  optimizedGoal: string;
  targetSpace?: Space;
  targetTicket?: Issue;
  targetTicketKey?: string;
  targetStatus?: string;
  newIssueType?: string;
  newIssueTitle?: string;
  searchKeyword?: string;
  /** for the sprint intents: the sprint the prompt is about */
  targetSprint?: string;
}
