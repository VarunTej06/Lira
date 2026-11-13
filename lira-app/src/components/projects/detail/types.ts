import type { Project } from '../../../types/project';
import type { Space } from '../../../types/space';
import type { Issue } from '../../../types/issue';

export interface ProjectDetailViewProps {
  project: Project;
  space: Space | undefined;
  issues: Issue[];
  onBack: () => void;
  onUpdateProject?: (updated: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onIssueClick?: (issue: Issue) => void;
  onAddIssue?: (status: string) => void;
  onSwitchToSpace?: (spaceId: number) => void;
}

export type TabType = 'overview' | 'board' | 'tickets' | 'sprints' | 'technical' | 'settings';
export type TicketSubTab = 'all' | 'open' | 'completed' | 'high_priority' | 'my_tasks';

export interface WorkflowStateItem {
  id: string;
  key: string;
  label: string;
  category: string;
  color: string;
}

export interface CustomFieldItem {
  id: string;
  name: string;
  type: string;
  description: string;
}

export const DEFAULT_WORKFLOW_STATES: WorkflowStateItem[] = [
  { id: 'backlog', key: 'backlog', label: 'Backlog', category: 'To Do', color: 'bg-slate-400' },
  { id: 'todo', key: 'todo', label: 'To Do', category: 'Ready', color: 'bg-blue-500' },
  { id: 'inprogress', key: 'inprogress', label: 'In Progress', category: 'In Progress', color: 'bg-amber-500' },
  { id: 'done', key: 'done', label: 'Done', category: 'Resolved', color: 'bg-emerald-500' },
];

export const DEFAULT_CUSTOM_FIELDS: CustomFieldItem[] = [
  { id: 'cf-1', name: 'Story Points', type: 'Number', description: 'Sprint velocity & effort estimation' },
  { id: 'cf-2', name: 'Epic Link', type: 'Hierarchy Relation', description: 'Parent Epic issue connection' },
  { id: 'cf-3', name: 'Target Environment', type: 'Dropdown', description: 'Deployment target (Dev, Staging, Prod)' },
  { id: 'cf-4', name: 'Git Branch / PR', type: 'Text Link', description: 'Associated repository branch or pull request' },
  { id: 'cf-5', name: 'Customer Impact', type: 'Single Select', description: 'Severity score for client-facing features' },
];
