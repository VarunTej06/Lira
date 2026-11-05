import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  FolderKanban, Plus, Search, Layers, ChevronRight, SlidersHorizontal
} from 'lucide-react';
import { Button } from '../common/Button';
import { CreateProjectModal } from './CreateProjectModal';
import { StandupButton } from '../standup/StandupButton';
import { DEFAULT_PROJECTS, writeProjects } from '../../hooks/useProjects';
import { ProjectDetailView } from './ProjectDetailView';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import type { Project } from '../../types/project';

interface ProjectsOverviewProps {
  spaces: Space[];
  issues: Issue[];
  selectedProjectId?: string | null;
  onSelectProject?: (project: Project) => void;
  onSelectSpace?: (spaceId: number) => void;
  onIssueClick?: (issue: Issue) => void;
  onAddIssue?: (status: string) => void;
}


export const ProjectsOverview: React.FC<ProjectsOverviewProps> = ({
  spaces,
  issues,
  onSelectProject,
  onSelectSpace,
  onIssueClick,
  onAddIssue,
}) => {
  const [internalSelectedProject, setInternalSelectedProject] = useState<Project | null>(null);

  // Load projects from localStorage `lira_projects`
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem('lira_projects');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse lira_projects from localStorage', e);
    }
    const def = DEFAULT_PROJECTS(spaces);
    try { localStorage.setItem('lira_projects', JSON.stringify(def)); } catch { /* storage unavailable */ }
    return def;
  });

  // Re-read latest projects from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lira_projects');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to reload lira_projects', e);
    }
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'key'>('recent');

  // Sync to localStorage whenever projects state changes
  const saveProjects = useCallback((updated: Project[]) => {
    setProjects(updated);
    try {
      writeProjects(updated);
    } catch (e) {
      console.error('Failed to save lira_projects', e);
    }
  }, []);

  const handleSelectProject = useCallback((project: Project) => {
    if (onSelectProject) {
      onSelectProject(project);
    } else {
      setInternalSelectedProject(project);
    }
  }, [onSelectProject]);

  const handleProjectCreated = (newProject: Project) => {
    const updated = [newProject, ...projects.filter(p => p.id !== newProject.id)];
    saveProjects(updated);
    handleSelectProject(newProject);
  };

  const handleProjectUpdated = (updated: Project) => {
    const next = projects.map(p => p.id === updated.id ? updated : p);
    saveProjects(next);
    if (internalSelectedProject?.id === updated.id) {
      setInternalSelectedProject(updated);
    }
  };

  const handleProjectDeleted = (projectId: string) => {
    const next = projects.filter(p => p.id !== projectId);
    saveProjects(next);
    setInternalSelectedProject(null);
  };

  // Filtered & sorted projects list for the overview grid
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.lead.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }

    if (selectedSpaceFilter !== 'all') {
      const spaceNum = Number(selectedSpaceFilter);
      list = list.filter(p => p.spaceId === spaceNum);
    }

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'key') return a.key.localeCompare(b.key);
      const aDate = new Date(a.updatedAt || a.createdAt).getTime();
      const bDate = new Date(b.updatedAt || b.createdAt).getTime();
      return bDate - aDate;
    });

    return list;
  }, [projects, searchQuery, selectedSpaceFilter, sortBy]);

  // If no external onSelectProject is provided and a project is selected internally, render ProjectDetailView
  if (!onSelectProject && internalSelectedProject) {
    const activeProjectSpace = spaces.find(s => s.id === internalSelectedProject.spaceId) || spaces.find(s => s.key === internalSelectedProject.key);
    return (
      <ProjectDetailView
        project={internalSelectedProject}
        space={activeProjectSpace}
        issues={issues}
        onBack={() => setInternalSelectedProject(null)}
        onUpdateProject={handleProjectUpdated}
        onDeleteProject={handleProjectDeleted}
        onIssueClick={onIssueClick}
        onAddIssue={onAddIssue}
        onSwitchToSpace={onSelectSpace}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-jira-bg font-sans">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-jira-border px-8 py-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shadow-xs">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-jira-text tracking-tight">Projects</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {projects.length} Total
              </span>
            </div>
            <p className="text-xs text-jira-muted mt-1 max-w-xl">
              Directory of software engineering initiatives, technical architectures, environments, and Space associations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Create Project
            </Button>
          </div>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="bg-white/60 backdrop-blur-xs border-b border-jira-border px-8 py-3.5 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex items-center gap-3 flex-1 min-w-[260px] max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects by name, key, lead, or description..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-jira-border rounded-lg focus:outline-none focus:border-jira-blue shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Controls: Space filter & sorting */}
          <div className="flex items-center gap-3 text-xs">
            {/* Space Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-jira-muted" />
              <select
                value={selectedSpaceFilter}
                onChange={e => setSelectedSpaceFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-jira-border rounded-lg text-jira-text cursor-pointer focus:outline-none focus:border-jira-blue"
              >
                <option value="all">All Spaces ({spaces.length})</option>
                {spaces.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name} ({s.key})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-jira-muted" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'recent' | 'name' | 'key')}
                className="px-2.5 py-1.5 bg-white border border-jira-border rounded-lg text-jira-text cursor-pointer focus:outline-none focus:border-jira-blue"
              >
                <option value="recent">Recently Updated</option>
                <option value="name">Project Name (A-Z)</option>
                <option value="key">Key (Prefix)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Projects Grid ── */}
      <div className="p-8 max-w-7xl mx-auto w-full flex-1">
        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-jira-border p-12 text-center max-w-md mx-auto shadow-xs my-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-jira-blue mx-auto flex items-center justify-center text-2xl shadow-inner">
              📁
            </div>
            <div>
              <h3 className="text-base font-bold text-jira-text">No projects found</h3>
              <p className="text-xs text-jira-muted mt-1 leading-relaxed">
                {searchQuery || selectedSpaceFilter !== 'all'
                  ? 'No projects match your search criteria. Try clearing active filters.'
                  : 'Get started by creating your first technical project.'}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              {(searchQuery || selectedSpaceFilter !== 'all') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setSearchQuery(''); setSelectedSpaceFilter('all'); }}
                >
                  Clear Filters
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Create Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => {
              const matchedSpace = spaces.find(s => s.id === project.spaceId) || spaces.find(s => s.key === project.key);
              const projectIssues = issues.filter(i => {
                if (project.spaceId && i.spaceId === project.spaceId) return true;
                if (project.key && i.key.startsWith(`${project.key}-`)) return true;
                return false;
              });
              const totalIssues = projectIssues.length;
              const doneIssues = projectIssues.filter(i => i.status.toLowerCase() === 'done').length;
              const percent = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

              return (
                <div
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className="bg-white rounded-xl border border-jira-border hover:border-jira-blue/60 p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-xs flex-shrink-0"
                          style={{
                            backgroundColor: (matchedSpace?.color || '#0052CC') + '20',
                            color: matchedSpace?.color || '#0052CC'
                          }}
                        >
                          {matchedSpace?.icon || '📁'}
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-jira-text group-hover:text-jira-blue transition-colors line-clamp-1">
                            {project.name}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] font-bold bg-blue-50 text-jira-blue px-1.5 py-0.2 rounded border border-blue-200">
                              {project.key}
                            </span>
                            <span className="text-jira-muted text-[11px]">·</span>
                            <span className="text-[11px] text-jira-muted truncate max-w-[130px]">
                              {project.category || 'Software'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Standup (stop clicks so the card doesn't open) */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <StandupButton
                          compact
                          className="!px-2 !py-1"
                          scope={{ type: 'project', id: `project:${project.id}`, name: project.name, spaceId: project.spaceId, projectKey: project.key }}
                        />
                      <div className="p-1 rounded-md text-gray-400 group-hover:text-jira-blue group-hover:bg-blue-50 transition-all flex-shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-jira-muted line-clamp-2 mt-2 leading-relaxed min-h-[36px]">
                      {project.description || 'No project description provided.'}
                    </p>

                    {/* Associated Space Tag */}
                    <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-semibold text-jira-muted">Space:</span>
                        {matchedSpace ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border"
                            style={{
                              backgroundColor: matchedSpace.color + '15',
                              borderColor: matchedSpace.color + '40',
                              color: matchedSpace.color
                            }}
                          >
                            <span>{matchedSpace.icon}</span>
                            <span>{matchedSpace.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Unlinked Space</span>
                        )}
                      </div>

                      {/* Lead */}
                      <div className="flex items-center gap-1 text-[11px] text-jira-muted font-medium">
                        <span className="w-5 h-5 rounded-full bg-jira-blue text-white text-[9px] font-bold flex items-center justify-center">
                          {project.lead?.slice(0, 2).toUpperCase() || 'VY'}
                        </span>
                        <span className="truncate max-w-[80px]">{project.lead || 'Varun Tej'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Progress Bar & Ticket Counts */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs mb-1.5 text-jira-muted">
                      <span className="text-[11px] font-medium">
                        {totalIssues} issue{totalIssues !== 1 ? 's' : ''} ({doneIssues} done)
                      </span>
                      <span className="font-semibold text-emerald-600 text-[11px]">{percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        spaces={spaces}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
};
