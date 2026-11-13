import { SpaceIcon } from '../../common/SpaceIcon';
import type { ComponentType } from 'react';
import { ArrowLeft, BarChart3, KanbanSquare, Ticket, GitBranch, Settings, Plus, ExternalLink, Clock, CalendarClock } from 'lucide-react';
import { Button } from '../../common/Button';
import { Avatar } from '../../common/Avatar';
import { formatAbsoluteDate } from '../../../utils/dateUtils';
import { StandupButton } from '../../standup/StandupButton';
import type { DetailCtx } from './detailContext';
import type { TabType } from './types';

/** The tab buttons, in order. `counted` tabs show the number of tickets. */
const TABS: { id: TabType; label: string; Icon: ComponentType<{ className?: string }>; counted?: boolean }[] = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'board', label: 'Board', Icon: KanbanSquare, counted: true },
  { id: 'tickets', label: 'Tickets', Icon: Ticket, counted: true },
  { id: 'sprints', label: 'Sprints', Icon: CalendarClock },
  { id: 'technical', label: 'Technical Details', Icon: GitBranch },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

function TopBar({ project, onBack, onAddIssue }: Pick<DetailCtx, 'project' | 'onBack' | 'onAddIssue'>) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted hover:text-lira-text transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          title="Return to Projects Overview"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Projects</span>
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-xs font-semibold text-lira-text">{project.name}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {onAddIssue && (
          <Button variant="primary" size="xs" onClick={() => onAddIssue('todo')} icon={<Plus className="w-3.5 h-3.5" />}>
            Create Issue
          </Button>
        )}
      </div>
    </div>
  );
}

/** The space the project belongs to, as a button that opens it, or a note when there is none. */
function SpaceLink({ space, onSwitchToSpace }: Pick<DetailCtx, 'space' | 'onSwitchToSpace'>) {
  if (!space || space.id === undefined) return <span className="text-gray-400 italic">No linked space</span>;
  return (
    <button
      onClick={() => onSwitchToSpace?.(space.id!)}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 hover:bg-lira-blue-light border border-lira-border hover:border-lira-blue rounded-md text-lira-text text-xs transition-all cursor-pointer group"
      title={`Switch workspace to space ${space.name}`}
    >
      <SpaceIcon icon={space.icon} className="w-3.5 h-3.5" />
      <span>Space: <strong className="group-hover:text-lira-blue">{space.name}</strong></span>
      <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-lira-blue" />
    </button>
  );
}

/** Lead, created date and the linked space. */
function ProjectFacts({ project, space, onSwitchToSpace }: Pick<DetailCtx, 'project' | 'space' | 'onSwitchToSpace'>) {
  return (
    <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-lira-muted">
      <div className="flex items-center gap-1.5">
        <Avatar initials={project.lead ? project.lead.slice(0, 2).toUpperCase() : 'VY'} size="xs" />
        <span>Lead: <strong className="text-lira-text">{project.lead || 'Varun Tej'}</strong></span>
      </div>
      <span className="text-gray-300">•</span>
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span>Created {formatAbsoluteDate(project.createdAt) || 'recently'}</span>
      </div>
      <span className="text-gray-300">•</span>
      <SpaceLink space={space} onSwitchToSpace={onSwitchToSpace} />
    </div>
  );
}

function Banner({ project, space, projectInitials, onSwitchToSpace }: Pick<DetailCtx, 'project' | 'space' | 'projectInitials' | 'onSwitchToSpace'>) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
      <div className="flex items-start sm:items-center gap-3.5">
        <div
          className="w-13 h-13 rounded-2xl flex items-center justify-center bg-lira-blue text-lira-on-blue text-lg font-black shadow-md flex-shrink-0"
        >
          {projectInitials}
        </div>
        <div>
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-xl font-bold text-lira-text tracking-tight">{project.name}</h1>
            <span className="font-mono text-xs font-bold bg-lira-blue-light text-lira-blue px-2 py-0.5 rounded border border-lira-border">{project.key}</span>
            {project.category && (
              <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded-full">{project.category}</span>
            )}
          </div>
          <p className="text-xs text-lira-muted mt-1 max-w-3xl line-clamp-2 leading-relaxed">
            {project.description || 'Enterprise-grade technical project workspace.'}
          </p>
          <ProjectFacts project={project} space={space} onSwitchToSpace={onSwitchToSpace} />
        </div>
      </div>
      {/* Right side of the banner so it is easy to spot */}
      <div className="flex-shrink-0 md:self-center">
        <StandupButton
          prominent
          scope={{ type: 'project', id: `project:${project.id}`, name: project.name, spaceId: project.spaceId, projectKey: project.key }}
        />
      </div>
    </div>
  );
}

function Tabs({ stats, activeTab, setActiveTab }: Pick<DetailCtx, 'stats' | 'activeTab' | 'setActiveTab'>) {
  return (
    <div className="flex items-center gap-6 border-b border-transparent text-sm overflow-x-auto no-scrollbar">
      {TABS.map(({ id, label, Icon, counted }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex items-center gap-2 pb-3 font-semibold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === id ? 'border-lira-blue text-lira-blue' : 'border-transparent text-lira-muted hover:text-lira-text'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {counted && <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-full font-normal">{stats.total}</span>}
        </button>
      ))}
    </div>
  );
}

/** Breadcrumbs, the project banner and the tab buttons. */
export function ProjectHeader({ project, space, onBack, onAddIssue, onSwitchToSpace, stats, projectInitials, activeTab, setActiveTab }: DetailCtx) {
  return (
    <div className="bg-white border-b border-lira-border px-6 pt-4 pb-0 flex-shrink-0">
      <TopBar project={project} onBack={onBack} onAddIssue={onAddIssue} />
      <Banner project={project} space={space} projectInitials={projectInitials} onSwitchToSpace={onSwitchToSpace} />
      <Tabs stats={stats} activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
