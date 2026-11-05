import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, BarChart3, KanbanSquare, Ticket, GitBranch,
  Settings, Plus, Search, ExternalLink, Check, Trash2, Save,
  Layers, Server, Clock, AlertCircle, CheckCircle2, TrendingUp,
  X, Code, Workflow, Sliders
} from 'lucide-react';
import { KanbanBoard } from '../board/KanbanBoard';
import { Button } from '../common/Button';
import { Avatar } from '../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { formatRelativeDate, formatAbsoluteDate } from '../../utils/dateUtils';
import type { Project } from '../../types/project';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';

interface ProjectDetailViewProps {
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

type TabType = 'overview' | 'board' | 'tickets' | 'technical' | 'settings';
type TicketSubTab = 'all' | 'open' | 'completed' | 'high_priority' | 'my_tasks';

interface WorkflowStateItem {
  id: string;
  key: string;
  label: string;
  category: string;
  color: string;
}

interface CustomFieldItem {
  id: string;
  name: string;
  type: string;
  description: string;
}

const DEFAULT_WORKFLOW_STATES: WorkflowStateItem[] = [
  { id: 'backlog', key: 'backlog', label: 'Backlog', category: 'To Do', color: 'bg-slate-400' },
  { id: 'todo', key: 'todo', label: 'To Do', category: 'Ready', color: 'bg-blue-500' },
  { id: 'inprogress', key: 'inprogress', label: 'In Progress', category: 'In Progress', color: 'bg-amber-500' },
  { id: 'done', key: 'done', label: 'Done', category: 'Resolved', color: 'bg-emerald-500' },
];

const DEFAULT_CUSTOM_FIELDS: CustomFieldItem[] = [
  { id: 'cf-1', name: 'Story Points', type: 'Number', description: 'Sprint velocity & effort estimation' },
  { id: 'cf-2', name: 'Epic Link', type: 'Hierarchy Relation', description: 'Parent Epic issue connection' },
  { id: 'cf-3', name: 'Target Environment', type: 'Dropdown', description: 'Deployment target (Dev, Staging, Prod)' },
  { id: 'cf-4', name: 'Git Branch / PR', type: 'Text Link', description: 'Associated repository branch or pull request' },
  { id: 'cf-5', name: 'Customer Impact', type: 'Single Select', description: 'Severity score for client-facing features' },
];

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  space,
  issues,
  onBack,
  onUpdateProject,
  onDeleteProject,
  onIssueClick,
  onAddIssue,
  onSwitchToSpace,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Filter issues for this project: match spaceId or issue key prefix
  const projectIssues = useMemo(() => {
    return issues.filter(i => {
      if (project.spaceId && i.spaceId === project.spaceId) return true;
      if (project.key && i.key.startsWith(`${project.key}-`)) return true;
      return false;
    });
  }, [issues, project.spaceId, project.key]);

  // Project progress & stats calculation
  const stats = useMemo(() => {
    const total = projectIssues.length;
    const done = projectIssues.filter(i => i.status.toLowerCase() === 'done').length;
    const inProgress = projectIssues.filter(i => i.status.toLowerCase() === 'inprogress').length;
    const todo = projectIssues.filter(i => i.status.toLowerCase() === 'todo').length;
    const backlog = projectIssues.filter(i => i.status.toLowerCase() === 'backlog').length;
    const open = backlog + todo + inProgress;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, todo, backlog, open, percent };
  }, [projectIssues]);

  // Project initials for icon
  const projectInitials = useMemo(() => {
    const words = project.name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return project.name.slice(0, 2).toUpperCase() || project.key.slice(0, 2).toUpperCase() || 'PR';
  }, [project.name, project.key]);

  // Priority counts for Tab 1
  const priorityCounts = useMemo(() => {
    const counts = { highest: 0, high: 0, medium: 0, low: 0, lowest: 0 };
    projectIssues.forEach(i => {
      const p = (i.priority || 'medium').toLowerCase() as keyof typeof counts;
      if (counts[p] !== undefined) {
        counts[p]++;
      } else {
        counts.medium++;
      }
    });
    return counts;
  }, [projectIssues]);

  // Recent 5 activity issues for Tab 1
  const recentIssues = useMemo(() => {
    const copy = [...projectIssues];
    copy.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
    return copy.slice(0, 5);
  }, [projectIssues]);

  // ── Tab 2: Board Filters ──
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(false);
  const [boardPriorityFilter, setBoardPriorityFilter] = useState('');

  const boardActiveFilters = useMemo(() => ({
    priorities: boardPriorityFilter ? [boardPriorityFilter] : [],
    labels: [],
  }), [boardPriorityFilter]);

  // ── Tab 3: Tickets View State ──
  const [ticketSubTab, setTicketSubTab] = useState<TicketSubTab>('all');
  const [ticketSearch, setTicketSearch] = useState('');

  const ticketCounts = useMemo(() => {
    return {
      all: projectIssues.length,
      open: projectIssues.filter(i => ['backlog', 'todo', 'inprogress'].includes(i.status.toLowerCase())).length,
      completed: projectIssues.filter(i => i.status.toLowerCase() === 'done').length,
      high_priority: projectIssues.filter(i => ['highest', 'high'].includes(i.priority?.toLowerCase())).length,
      my_tasks: projectIssues.filter(i => {
        const a = (i.assignee || '').toLowerCase();
        const init = (i.assigneeInitials || '').toUpperCase();
        return a.includes('varun') || a.includes('tej') || init === 'VY' || a === 'vy';
      }).length,
    };
  }, [projectIssues]);

  const ticketsToDisplay = useMemo(() => {
    let list = projectIssues;
    switch (ticketSubTab) {
      case 'open':
        list = list.filter(i => ['backlog', 'todo', 'inprogress'].includes(i.status.toLowerCase()));
        break;
      case 'completed':
        list = list.filter(i => i.status.toLowerCase() === 'done');
        break;
      case 'high_priority':
        list = list.filter(i => ['highest', 'high'].includes(i.priority?.toLowerCase()));
        break;
      case 'my_tasks':
        list = list.filter(i => {
          const a = (i.assignee || '').toLowerCase();
          const init = (i.assigneeInitials || '').toUpperCase();
          return a.includes('varun') || a.includes('tej') || init === 'VY' || a === 'vy';
        });
        break;
      case 'all':
      default:
        break;
    }

    if (ticketSearch.trim()) {
      const q = ticketSearch.toLowerCase();
      list = list.filter(i =>
        i.key.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        (i.assignee && i.assignee.toLowerCase().includes(q))
      );
    }

    return list;
  }, [projectIssues, ticketSubTab, ticketSearch]);

  // ── Tab 4: Technical Details Form State ──
  const [repoUrl, setRepoUrl] = useState(project.repoUrl || '');
  const [description, setDescription] = useState(project.description || '');
  const [lead, setLead] = useState(project.lead || 'Varun Tej');
  const [environments, setEnvironments] = useState<string[]>(
    project.environments && project.environments.length > 0
      ? project.environments
      : ['Development', 'Staging', 'Production']
  );
  const [newEnvInput, setNewEnvInput] = useState('');
  const [techSavedToast, setTechSavedToast] = useState(false);

  useEffect(() => {
    setRepoUrl(project.repoUrl || '');
    setDescription(project.description || '');
    setLead(project.lead || 'Varun Tej');
    if (project.environments && project.environments.length > 0) {
      setEnvironments(project.environments);
    }
  }, [project]);

  const handleAddEnv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvInput.trim()) return;
    const env = newEnvInput.trim();
    if (!environments.includes(env)) {
      setEnvironments(prev => [...prev, env]);
    }
    setNewEnvInput('');
  };

  const handleRemoveEnv = (env: string) => {
    setEnvironments(prev => prev.filter(e => e !== env));
  };

  const handleSaveTechnicalDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Project = {
      ...project,
      repoUrl: repoUrl.trim(),
      description: description.trim(),
      lead: lead.trim() || 'Varun Tej',
      environments,
      updatedAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem('lira_projects');
      if (raw) {
        const list: Project[] = JSON.parse(raw);
        const next = list.map(p => p.id === project.id ? updated : p);
        localStorage.setItem('lira_projects', JSON.stringify(next));
      }
    } catch (err) {
      console.error('Failed to update project in localStorage:', err);
    }

    onUpdateProject?.(updated);
    setTechSavedToast(true);
    setTimeout(() => setTechSavedToast(false), 2000);
  };

  // ── Tab 5: Settings State ──
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateItem[]>(() => {
    try {
      const raw = localStorage.getItem(`lira_project_settings_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.workflowStates) && parsed.workflowStates.length > 0) {
          return parsed.workflowStates;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_WORKFLOW_STATES;
  });

  const [customFields, setCustomFields] = useState<CustomFieldItem[]>(() => {
    try {
      const raw = localStorage.getItem(`lira_project_settings_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.customFields) && parsed.customFields.length > 0) {
          return parsed.customFields;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_CUSTOM_FIELDS;
  });

  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('Text');
  const [newFieldDesc, setNewFieldDesc] = useState('');

  const handleRenameState = (id: string, newLabel: string) => {
    setWorkflowStates(prev => prev.map(s => s.id === id ? { ...s, label: newLabel } : s));
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    const newField: CustomFieldItem = {
      id: `cf-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      description: newFieldDesc.trim() || `Configured field for ${project.name}`,
    };
    setCustomFields(prev => [...prev, newField]);
    setNewFieldName('');
    setNewFieldDesc('');
    setShowAddFieldModal(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        workflowStates,
        customFields,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`lira_project_settings_${project.id}`, JSON.stringify(payload));
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 2000);
    } catch (err) {
      console.error('Failed to save project settings:', err);
    }
  };

  const handleDeleteProject = () => {
    if (window.confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
      onDeleteProject?.(project.id);
    }
  };

  // Helper badge styles
  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'inprogress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'todo':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'backlog':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'highest':
        return <span className="inline-flex items-center gap-1 text-red-600 font-medium">🔴 Highest</span>;
      case 'high':
        return <span className="inline-flex items-center gap-1 text-orange-600 font-medium">🟠 High</span>;
      case 'medium':
        return <span className="inline-flex items-center gap-1 text-amber-600 font-medium">🟡 Medium</span>;
      case 'low':
        return <span className="inline-flex items-center gap-1 text-green-600 font-medium">🟢 Low</span>;
      case 'lowest':
        return <span className="inline-flex items-center gap-1 text-blue-400 font-medium">⚪ Lowest</span>;
      default:
        return <span className="text-gray-500 capitalize">{priority}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-jira-bg font-sans">
      {/* ── Top Project Header & Breadcrumbs ── */}
      <div className="bg-white border-b border-jira-border px-6 pt-4 pb-0 flex-shrink-0">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-jira-muted hover:text-jira-text transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Return to Projects Overview"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Projects</span>
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-semibold text-jira-text">{project.name}</span>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5">
            {onAddIssue && (
              <Button
                variant="primary"
                size="xs"
                onClick={() => onAddIssue('todo')}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Create Issue
              </Button>
            )}
          </div>
        </div>

        {/* Project Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Large Project Icon: colored circle with initials */}
            <div
              className="w-13 h-13 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md flex-shrink-0"
              style={{ backgroundColor: space?.color || '#0052CC' }}
            >
              {projectInitials}
            </div>

            <div>
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-xl font-bold text-jira-text tracking-tight">
                  {project.name}
                </h1>
                <span className="font-mono text-xs font-bold bg-blue-100 text-jira-blue px-2 py-0.5 rounded border border-blue-200">
                  {project.key}
                </span>
                {project.category && (
                  <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded-full">
                    {project.category}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-jira-muted mt-1 max-w-3xl line-clamp-2 leading-relaxed">
                {project.description || 'Enterprise Jira-grade technical project workspace.'}
              </p>

              {/* Lead, Created Date & Linked Space Tag */}
              <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-jira-muted">
                {/* Lead Avatar */}
                <div className="flex items-center gap-1.5">
                  <Avatar initials={project.lead ? project.lead.slice(0, 2).toUpperCase() : 'VY'} size="xs" />
                  <span>Lead: <strong className="text-jira-text">{project.lead || 'Varun Tej'}</strong></span>
                </div>

                <span className="text-gray-300">•</span>

                {/* Created Date */}
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Created {formatAbsoluteDate(project.createdAt) || 'recently'}</span>
                </div>

                <span className="text-gray-300">•</span>

                {/* Linked Space Tag (Clickable to go to space) */}
                {space && space.id !== undefined ? (
                  <button
                    onClick={() => onSwitchToSpace?.(space.id!)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 hover:bg-blue-50 border border-jira-border hover:border-jira-blue rounded-md text-jira-text text-xs transition-all cursor-pointer group"
                    title={`Switch workspace to space ${space.name}`}
                  >
                    <span>{space.icon || '📁'}</span>
                    <span>Space: <strong className="group-hover:text-jira-blue">{space.name}</strong></span>
                    <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-jira-blue" />
                  </button>
                ) : (
                  <span className="text-gray-400 italic">No linked space</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-6 border-b border-transparent text-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'board'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <KanbanSquare className="w-4 h-4" />
            <span>Board</span>
            <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-normal">
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'tickets'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Tickets</span>
            <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-normal">
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('technical')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'technical'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Technical Details</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* ── Main Tab Contents ── */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {/* ═══════════════════════════════════════════════════════
            TAB 1: OVERVIEW DASHBOARD
           ═══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Quick Actions Row */}
            <div className="bg-white rounded-xl border border-jira-border p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-jira-muted">Project Workspace Actions</h3>
                <p className="text-xs text-jira-text mt-0.5">Jump directly to issue authoring, Kanban execution, or project schema settings.</p>
              </div>
              <div className="flex items-center gap-2.5">
                {onAddIssue && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onAddIssue('todo')}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Create Issue
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('board')}
                  icon={<KanbanSquare className="w-4 h-4" />}
                >
                  View Board
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('settings')}
                  icon={<Settings className="w-4 h-4" />}
                >
                  Open Settings
                </Button>
              </div>
            </div>

            {/* At-a-Glance Metrics Row (4 Stat Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Total Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Total Issues</p>
                  <h4 className="text-2xl font-black text-jira-text mt-1">{stats.total}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">In this project scope</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-jira-blue flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 2: Open Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Open Issues</p>
                  <h4 className="text-2xl font-black text-amber-600 mt-1">{stats.open}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">Backlog + Todo + In Progress</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 3: Completed Issues */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Completed Issues</p>
                  <h4 className="text-2xl font-black text-emerald-600 mt-1">{stats.done}</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">Done & verified</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 4: Completion % */}
              <div className="bg-white rounded-xl border border-jira-border p-5 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-jira-muted uppercase tracking-wider">Completion %</p>
                  <h4 className="text-2xl font-black text-purple-600 mt-1">{stats.percent}%</h4>
                  <p className="text-[11px] text-jira-muted mt-0.5">{stats.done} of {stats.total} resolved</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Status Distribution Chart (Pure Tailwind / SVG Stacked Bar) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Status Distribution</h3>
                  <p className="text-xs text-jira-muted mt-0.5">
                    Proportional workflow breakdown across Backlog, To Do, In Progress, and Done stages.
                  </p>
                </div>
                <span className="text-xs font-semibold text-jira-muted">{stats.total} Items</span>
              </div>

              {stats.total === 0 ? (
                <div className="py-8 text-center text-xs text-jira-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No issues recorded yet for this project. Click <strong>Create Issue</strong> above to start.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Horizontal Stacked Bar */}
                  <div className="h-7 w-full bg-gray-100 rounded-xl overflow-hidden flex shadow-inner border border-gray-200/80">
                    {stats.backlog > 0 && (
                      <div
                        style={{ width: `${(stats.backlog / stats.total) * 100}%` }}
                        className="bg-slate-400 hover:bg-slate-500 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`Backlog: ${stats.backlog} (${Math.round((stats.backlog / stats.total) * 100)}%)`}
                      >
                        {stats.backlog / stats.total >= 0.1 && (
                          <span>{Math.round((stats.backlog / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.todo > 0 && (
                      <div
                        style={{ width: `${(stats.todo / stats.total) * 100}%` }}
                        className="bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`To Do: ${stats.todo} (${Math.round((stats.todo / stats.total) * 100)}%)`}
                      >
                        {stats.todo / stats.total >= 0.1 && (
                          <span>{Math.round((stats.todo / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.inProgress > 0 && (
                      <div
                        style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
                        className="bg-amber-500 hover:bg-amber-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`In Progress: ${stats.inProgress} (${Math.round((stats.inProgress / stats.total) * 100)}%)`}
                      >
                        {stats.inProgress / stats.total >= 0.1 && (
                          <span>{Math.round((stats.inProgress / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}

                    {stats.done > 0 && (
                      <div
                        style={{ width: `${(stats.done / stats.total) * 100}%` }}
                        className="bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center text-white text-[11px] font-bold px-1 relative group cursor-pointer"
                        title={`Done: ${stats.done} (${Math.round((stats.done / stats.total) * 100)}%)`}
                      >
                        {stats.done / stats.total >= 0.1 && (
                          <span>{Math.round((stats.done / stats.total) * 100)}%</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Legend Row with Counts & Percentages */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="w-3 h-3 rounded-full bg-slate-400 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">Backlog: </span>
                        <span className="font-bold text-jira-text">{stats.backlog}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.backlog / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
                      <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">To Do: </span>
                        <span className="font-bold text-jira-blue">{stats.todo}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.todo / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                      <span className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">In Progress: </span>
                        <span className="font-bold text-amber-700">{stats.inProgress}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div className="text-xs">
                        <span className="text-jira-muted font-medium">Done: </span>
                        <span className="font-bold text-emerald-700">{stats.done}</span>
                        <span className="text-[10px] text-jira-muted ml-1">
                          ({stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Priority Breakdown (Grid of 5 Priority Chips) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Priority Breakdown</h3>
                  <p className="text-xs text-jira-muted mt-0.5">Issue volume classified by operational severity</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* Highest */}
                <div className="p-3 rounded-xl border border-red-200 bg-red-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                      <span>🔴</span> Highest
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-red-800">{priorityCounts.highest}</span>
                    <span className="text-[10px] text-red-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.highest / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* High */}
                <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                      <span>🟠</span> High
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-orange-800">{priorityCounts.high}</span>
                    <span className="text-[10px] text-orange-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.high / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Medium */}
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <span>🟡</span> Medium
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-amber-800">{priorityCounts.medium}</span>
                    <span className="text-[10px] text-amber-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.medium / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Low */}
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <span>🟢</span> Low
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-800">{priorityCounts.low}</span>
                    <span className="text-[10px] text-emerald-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.low / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Lowest */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>⚪</span> Lowest
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-800">{priorityCounts.lowest}</span>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {stats.total > 0 ? Math.round((priorityCounts.lowest / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity (Last 5 Updated Issues) */}
            <div className="bg-white rounded-xl border border-jira-border p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Recent Activity</h3>
                  <p className="text-xs text-jira-muted mt-0.5">Last 5 recently modified issues in this project</p>
                </div>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="text-xs font-semibold text-jira-blue hover:underline cursor-pointer"
                >
                  View all ({stats.total}) →
                </button>
              </div>

              {recentIssues.length === 0 ? (
                <div className="py-8 text-center text-xs text-jira-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No issues available to display.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 border border-jira-border rounded-xl overflow-hidden">
                  {recentIssues.map(issue => (
                    <div
                      key={issue.id || issue.key}
                      onClick={() => onIssueClick?.(issue)}
                      className="p-3.5 hover:bg-blue-50/50 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base" title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type}>
                          {ISSUE_TYPE_CONFIG[issue.type]?.symbol || '📋'}
                        </span>
                        <span className="font-mono text-xs font-bold text-jira-blue group-hover:underline whitespace-nowrap">
                          {issue.key}
                        </span>
                        <span className="text-xs text-jira-text font-medium truncate group-hover:text-jira-blue transition-colors">
                          {issue.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${getStatusBadgeClass(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className="text-xs text-jira-muted whitespace-nowrap">
                          {formatRelativeDate(issue.updatedAt || issue.createdAt) || 'Recently'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 2: KANBAN BOARD
           ═══════════════════════════════════════════════════════ */}
        {activeTab === 'board' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Filter Sub-bar */}
            <div className="bg-white/80 backdrop-blur-xs border-b border-jira-border px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={boardSearchQuery}
                    onChange={e => setBoardSearchQuery(e.target.value)}
                    placeholder={`Search issues in ${project.name}...`}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue focus:bg-white transition-all"
                  />
                </div>

                {/* Assignee filter button */}
                <button
                  onClick={() => setFilterAssignee(v => !v)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                    filterAssignee
                      ? 'bg-blue-50 border-jira-blue text-jira-blue'
                      : 'bg-white border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  Only My Issues (VY)
                </button>

                {/* Priority filters */}
                <select
                  value={boardPriorityFilter}
                  onChange={e => setBoardPriorityFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-jira-border rounded-lg text-jira-text cursor-pointer focus:outline-none focus:border-jira-blue"
                >
                  <option value="">All Priorities</option>
                  <option value="highest">Highest</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Progress Summary Metrics */}
              <div className="flex items-center gap-3 text-xs text-jira-muted">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-jira-text">{stats.done}/{stats.total}</span>
                  <span>done</span>
                </div>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
                <span className="font-semibold text-emerald-600">{stats.percent}%</span>
              </div>
            </div>

            {/* Kanban Board Container */}
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <KanbanBoard
                issues={projectIssues}
                space={space}
                searchQuery={boardSearchQuery}
                filterAssignee={filterAssignee}
                onIssueClick={onIssueClick || (() => {})}
                onAddIssue={onAddIssue || (() => {})}
                activeFilters={boardActiveFilters}
                groupBy="status"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 3: TICKETS (NEW TAB)
           ═══════════════════════════════════════════════════════ */}
        {activeTab === 'tickets' && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
            {/* Sub-tabs & Search Toolbar */}
            <div className="px-6 py-3 border-b border-jira-border bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              {/* Sub-tabs: All, Open, Completed, High Priority, My Tasks */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setTicketSubTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'all'
                      ? 'bg-jira-blue text-white shadow-2xs'
                      : 'bg-white border border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  <span>All</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${ticketSubTab === 'all' ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {ticketCounts.all}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'open'
                      ? 'bg-jira-blue text-white shadow-2xs'
                      : 'bg-white border border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  <span>Open</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${ticketSubTab === 'open' ? 'bg-blue-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    {ticketCounts.open}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'completed'
                      ? 'bg-jira-blue text-white shadow-2xs'
                      : 'bg-white border border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  <span>Completed</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${ticketSubTab === 'completed' ? 'bg-blue-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                    {ticketCounts.completed}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('high_priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'high_priority'
                      ? 'bg-jira-blue text-white shadow-2xs'
                      : 'bg-white border border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  <span>High Priority</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${ticketSubTab === 'high_priority' ? 'bg-blue-800 text-white' : 'bg-red-100 text-red-800'}`}>
                    {ticketCounts.high_priority}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('my_tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'my_tasks'
                      ? 'bg-jira-blue text-white shadow-2xs'
                      : 'bg-white border border-jira-border text-jira-muted hover:text-jira-text'
                  }`}
                >
                  <span>My Tasks</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${ticketSubTab === 'my_tasks' ? 'bg-blue-800 text-white' : 'bg-purple-100 text-purple-800'}`}>
                    {ticketCounts.my_tasks}
                  </span>
                </button>
              </div>

              {/* Search Within Tickets */}
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Filter tickets..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue shadow-2xs"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#F4F5F7] sticky top-0 z-10 border-b border-gray-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-12 text-center">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Key</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 min-w-[220px]">Title</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Priority</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-36">Assignee</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-32">Updated Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ticketsToDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Ticket className="w-8 h-8 text-gray-300" />
                          <p className="text-sm font-semibold text-jira-text">No tickets found</p>
                          <p className="text-xs text-jira-muted">
                            {ticketSearch ? 'Try adjusting your search query.' : 'There are no tickets matching the active sub-tab.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ticketsToDisplay.map(issue => (
                      <tr
                        key={issue.id || issue.key}
                        onClick={() => onIssueClick?.(issue)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        {/* Type Icon */}
                        <td className="py-2.5 px-3 text-center text-sm">
                          <span title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type}>
                            {ISSUE_TYPE_CONFIG[issue.type]?.symbol || '📋'}
                          </span>
                        </td>

                        {/* Key */}
                        <td className="py-2.5 px-3 font-mono font-bold text-jira-blue group-hover:underline whitespace-nowrap">
                          {issue.key}
                        </td>

                        {/* Title */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-jira-text group-hover:text-jira-blue transition-colors line-clamp-1">
                            {issue.title}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border capitalize ${getStatusBadgeClass(issue.status)}`}>
                            {issue.status}
                          </span>
                        </td>

                        {/* Priority Dot */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getPriorityBadge(issue.priority)}
                        </td>

                        {/* Assignee Avatar */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar
                              initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN')}
                              size="xs"
                            />
                            <span className="truncate max-w-[110px] text-jira-text">
                              {issue.assignee || 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Updated Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-jira-muted text-xs">
                          {formatRelativeDate(issue.updatedAt || issue.createdAt) || formatAbsoluteDate(issue.updatedAt || issue.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 4: TECHNICAL DETAILS
           ═══════════════════════════════════════════════════════ */}
        {activeTab === 'technical' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full">
            <div className="bg-white rounded-xl border border-jira-border shadow-xs p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-jira-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-jira-text flex items-center gap-2">
                    <Code className="w-5 h-5 text-jira-blue" />
                    Technical Details & Environments
                  </h2>
                  <p className="text-xs text-jira-muted mt-1">
                    Manage Git repositories, architecture scope, engineering leads, and deployment target environments.
                  </p>
                </div>
                {techSavedToast && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>✓ Saved</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveTechnicalDetails} className="space-y-6">
                {/* Repository URL */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Source Code Repository Link (Repo URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <GitBranch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        value={repoUrl}
                        onChange={e => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/organization/project-repository"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue transition-all"
                      />
                    </div>
                    {repoUrl && (
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-jira-text text-sm rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Visit</span>
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-jira-muted mt-1">
                    Direct VCS endpoint for branch associations, commit tracking, and PR automation.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Description & Architectural Scope
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide technical overview, architecture constraints, API contracts, or sprint scope..."
                    className="w-full text-sm border border-jira-border rounded-lg p-3 focus:outline-none focus:border-jira-blue resize-none transition-all"
                  />
                </div>

                {/* Lead */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Technical Lead / Owner
                  </label>
                  <input
                    type="text"
                    value={lead}
                    onChange={e => setLead(e.target.value)}
                    className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 focus:outline-none focus:border-jira-blue"
                  />
                </div>

                {/* Environments Tags */}
                <div>
                  <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-2">
                    Environments (Tags)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {environments.map(env => (
                      <div
                        key={env}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-jira-blue border border-blue-200 rounded-lg text-xs font-semibold"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>{env}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEnv(env)}
                          className="hover:text-red-500 transition-colors ml-1 cursor-pointer"
                          title={`Remove ${env}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add environment tag input */}
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={newEnvInput}
                      onChange={e => setNewEnvInput(e.target.value)}
                      placeholder="Add environment tag (e.g. QA, UAT)..."
                      className="flex-1 px-3 py-1.5 text-xs border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={handleAddEnv}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Save button */}
                <div className="pt-4 border-t border-jira-border flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Save className="w-4 h-4" />}
                  >
                    Save Technical Details
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 5: SETTINGS
           ═══════════════════════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-jira-text">Project Settings</h2>
                <p className="text-xs text-jira-muted mt-0.5">Configure workflow states, custom fields, and administrative schema.</p>
              </div>
              {settingsSavedToast && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>✓ Saved</span>
                </div>
              )}
            </div>

            {/* 1. Workflow States (with ability to rename) */}
            <div className="bg-white rounded-xl border border-jira-border shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-jira-border pb-3">
                <Workflow className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-jira-text">Workflow States</h3>
                  <p className="text-xs text-jira-muted mt-0.5">
                    Customize the display labels for each issue lifecycle transition state.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {workflowStates.map(state => (
                  <div key={state.id} className="p-3.5 bg-gray-50/70 border border-jira-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${state.color}`} />
                        <span className="font-mono text-xs font-semibold text-jira-muted uppercase">{state.key}</span>
                      </div>
                      <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        Category: {state.category}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-jira-muted mb-1">State Display Label</label>
                      <input
                        type="text"
                        value={state.label}
                        onChange={e => handleRenameState(state.id, e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-jira-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-jira-blue"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Custom Fields */}
            <div className="bg-white rounded-xl border border-jira-border shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-jira-border pb-3">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="text-sm font-bold text-jira-text">Custom Fields</h3>
                    <p className="text-xs text-jira-muted mt-0.5">
                      Configured attribute schema for issue tracking and analytics.
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setShowAddFieldModal(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add Custom Field
                </Button>
              </div>

              <div className="divide-y divide-gray-100 border border-jira-border rounded-xl overflow-hidden">
                {customFields.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-jira-text">{f.name}</span>
                        <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          {f.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-jira-muted mt-0.5">{f.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(f.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove custom field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                icon={<Save className="w-4 h-4" />}
              >
                Save Project Settings
              </Button>
            </div>

            {/* 3. Danger Zone */}
            <div className="bg-white rounded-xl border border-red-200 shadow-xs p-6 space-y-3">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Danger Zone
              </h3>
              <p className="text-xs text-jira-muted">
                Deleting this project unlinks it from the project directory. The underlying Space ({space?.name || project.key}) and its tickets will remain safely preserved in the database.
              </p>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Custom Field Modal */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-modal w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-jira-text">Add Custom Field to Project</h3>
            <form onSubmit={handleAddCustomField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1">
                  Field Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                  placeholder="e.g. Story Points, Release Version"
                  className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 focus:outline-none focus:border-jira-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1">
                  Field Type
                </label>
                <select
                  value={newFieldType}
                  onChange={e => setNewFieldType(e.target.value)}
                  className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-jira-blue"
                >
                  <option value="Text">Single-line Text</option>
                  <option value="Number">Numeric Value</option>
                  <option value="Date">Date Picker</option>
                  <option value="Select">Dropdown Select</option>
                  <option value="User">User Picker</option>
                  <option value="URL">Web URL / Hyperlink</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-jira-muted uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newFieldDesc}
                  onChange={e => setNewFieldDesc(e.target.value)}
                  placeholder="Brief description of field usage"
                  className="w-full text-sm border border-jira-border rounded-lg px-3 py-2 focus:outline-none focus:border-jira-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-jira-border">
                <Button type="button" variant="ghost" onClick={() => setShowAddFieldModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Add Field
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 2-second green toast */}
      {(techSavedToast || settingsSavedToast) && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-xl animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-white" />
          <span>✓ Saved</span>
        </div>
      )}
    </div>
  );
};
