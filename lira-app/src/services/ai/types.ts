import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actionTaken?: {
    type: 'created_issue' | 'updated_status' | 'added_subtasks' | 'summary' | 'switch_to_agent';
    issue?: Issue;
    details?: string;
  };
  suggestedActions?: string[];
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
    | 'overview';
  optimizedGoal: string;
  targetSpace?: Space;
  targetTicket?: Issue;
  targetTicketKey?: string;
  targetStatus?: string;
  newIssueType?: string;
  newIssueTitle?: string;
  searchKeyword?: string;
}
