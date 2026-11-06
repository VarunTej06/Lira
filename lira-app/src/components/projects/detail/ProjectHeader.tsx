import { ArrowLeft, BarChart3, KanbanSquare, Ticket, GitBranch, Settings, Plus, ExternalLink, Clock, CalendarClock } from 'lucide-react';
import { Button } from '../../common/Button';
import { Avatar } from '../../common/Avatar';
import { formatAbsoluteDate } from '../../../utils/dateUtils';
import { StandupButton } from '../../standup/StandupButton';
import type { DetailCtx } from './types';

/** Breadcrumbs, the project banner and the tab buttons. */
export function ProjectHeader(ctx: DetailCtx) {
  const { project, space, onBack, onAddIssue, onSwitchToSpace, stats, projectInitials, activeTab, setActiveTab } = ctx;
  return (
    <>
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

          {/* Standup — right side of the banner so it is easy to spot */}
          <div className="flex-shrink-0 md:self-center">
            <StandupButton
              prominent
              scope={{ type: 'project', id: `project:${project.id}`, name: project.name, spaceId: project.spaceId, projectKey: project.key }}
            />
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
            onClick={() => setActiveTab('sprints')}
            className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'sprints'
                ? 'border-jira-blue text-jira-blue'
                : 'border-transparent text-jira-muted hover:text-jira-text'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Sprints</span>
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
    </>
  );
}
