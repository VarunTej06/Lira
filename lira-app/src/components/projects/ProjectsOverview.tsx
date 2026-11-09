import { filterProjects, type ProjectSort } from '../../utils/projectFilter';
import React, { useState, useMemo, useCallback } from 'react';
import {
  FolderKanban, Plus, Search, Layers, SlidersHorizontal
} from 'lucide-react';
import { Button } from '../common/Button';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectCard } from './ProjectCard';
import { DEFAULT_PROJECTS, writeProjects } from '../../hooks/useProjects';
import { ProjectDetailView } from './ProjectDetailView';
import type { Space } from '../../types/space';
import type { Issue } from '../../types/issue';
import type { Project } from '../../types/project';
import { appStorage } from '../../utils/appStorage';

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
      const raw = appStorage.get('lira_projects');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse lira_projects from localStorage', e);
    }
    const def = DEFAULT_PROJECTS(spaces);
    try { appStorage.set('lira_projects', JSON.stringify(def)); } catch { /* storage unavailable */ }
    return def;
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaceFilter, setSelectedSpaceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<ProjectSort>('recent');

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
  const filteredProjects = useMemo(() => filterProjects(projects, searchQuery, selectedSpaceFilter, sortBy), [projects, searchQuery, selectedSpaceFilter, sortBy]);

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
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-lira-bg font-sans">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-lira-border px-8 py-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shadow-xs">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-lira-text tracking-tight">Projects</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {projects.length} Total
              </span>
            </div>
            <p className="text-xs text-lira-muted mt-1 max-w-xl">
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
      <div className="bg-white/60 backdrop-blur-xs border-b border-lira-border px-8 py-3.5 flex-shrink-0">
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
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Controls: Space filter & sorting */}
          <div className="flex items-center gap-3 text-xs">
            {/* Space Filter */}
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-lira-muted" />
              <select
                value={selectedSpaceFilter}
                onChange={e => setSelectedSpaceFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-lira-border rounded-lg text-lira-text cursor-pointer focus:outline-none focus:border-lira-blue"
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
              <SlidersHorizontal className="w-3.5 h-3.5 text-lira-muted" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as ProjectSort)}
                className="px-2.5 py-1.5 bg-white border border-lira-border rounded-lg text-lira-text cursor-pointer focus:outline-none focus:border-lira-blue"
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
          <div className="bg-white rounded-2xl border border-lira-border p-12 text-center max-w-md mx-auto shadow-xs my-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-lira-blue mx-auto flex items-center justify-center text-2xl shadow-inner">
              <FolderKanban className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-lira-text">No projects found</h3>
              <p className="text-xs text-lira-muted mt-1 leading-relaxed">
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
            {filteredProjects.map(project => <ProjectCard key={project.id} project={project} spaces={spaces} issues={issues} onOpen={handleSelectProject} />)}
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
