import { useState, useEffect, useCallback, useMemo } from 'react';
import { TopNavigation } from './components/layout/TopNavigation';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { BoardActionBar } from './components/board/BoardActionBar';
import { KanbanBoard } from './components/board/KanbanBoard';
import { SummaryView } from './components/board/SummaryView';
import { CapacityView } from './components/board/CapacityView';
import { FiltersPage } from './components/filter/FiltersPage';
import { IssueDetailModal } from './components/issue/IssueDetailModal';
import { CreateIssueModal } from './components/issue/CreateIssueModal';
import { CreateSpaceModal } from './components/board/CreateSpaceModal';
import { ListView } from './components/layout/ListView';
import { CalendarView } from './components/layout/CalendarView';
import { ProjectsOverview } from './components/projects/ProjectsOverview';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { VivaAIChatbot } from './components/ai/VivaAIChatbot';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SprintsPage } from './components/sprints/SprintsPage';
import { SprintsOverview } from './components/sprints/SprintsOverview';
import { ForYouPage } from './components/foryou/ForYouPage';
import { RoadmapsPage } from './components/roadmap/RoadmapsPage';
import { syncPendingRoadmaps } from './services/roadmapEpics';
import { AllTicketsPage } from './components/sprints/AllTicketsPage';
import { SprintFilterBar } from './components/sprints/sprintParts';
import { allSprintKeys, deleteSprint, getIssueSprint, stampLegacySprints, issuesInSprint, sprintStats, currentSprintKey, SPRINTS_EVENT } from './utils/sprintUtils';
import { CreateSprintModal } from './components/sprints/CreateSprintModal';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { useProjects, writeProjects } from './hooks/useProjects';
import { useSpaces } from './hooks/useSpaces';
import { useIssuesBySpace, useAllIssues } from './hooks/useIssues';
import { requestDurableStorage } from './db/db';
import { initLocalDiskSync } from './services/localDiskSync';
import type { Issue } from './types/issue';
import type { Project } from './types/project';
import type { Space } from './types/space';

type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';

// Full-page (cross-space) views. Selecting a space from the sidebar always leaves these.
const GLOBAL_TABS = ['ForYou', 'Filters', 'Projects', 'SprintsHub', 'SprintDetail', 'AllTickets', 'Roadmaps'];

// Immediately apply stored theme to documentElement before render if in browser
if (typeof window !== 'undefined') {
  const initialTheme = localStorage.getItem('lira_theme');
  if (initialTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}

export default function App() {
  const spaces = useSpaces();
  const [activeSpaceId, setActiveSpaceId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('lira_active_space_id');
    return saved ? Number(saved) : undefined;
  });

  const [activeTab, setActiveTab] = useState('Board');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Apply lira_theme on app mount immediately
  useEffect(() => {
    const savedTheme = localStorage.getItem('lira_theme');
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Auto-collapse sidebar when on Filters page
  useEffect(() => {
    if (activeTab === 'Filters') {
      setSidebarCollapsed(true);
    }
  }, [activeTab]);

  // Hidden and Archived spaces states persisted to localStorage
  const [hiddenSpaceIds, setHiddenSpaceIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('lira_hidden_spaces');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [archivedSpaceIds, setArchivedSpaceIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('lira_archived_spaces');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editingSpace, setEditingSpace] = useState<Space | null>(null);

  const toggleHideSpace = useCallback((id: number) => {
    setHiddenSpaceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('lira_hidden_spaces', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleArchiveSpace = useCallback((id: number) => {
    setArchivedSpaceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('lira_archived_spaces', JSON.stringify(next));
      return next;
    });
  }, []);

  const unhideAllSpaces = useCallback(() => {
    setHiddenSpaceIds([]);
    localStorage.setItem('lira_hidden_spaces', JSON.stringify([]));
  }, []);

  const handleSelectSpace = useCallback((id: number) => {
    setActiveSpaceId(id);
    localStorage.setItem('lira_active_space_id', String(id));
    setSelectedProject(null);
    if (GLOBAL_TABS.includes(activeTab)) {
      setActiveTab('Board');
      setSidebarCollapsed(false);
    }
  }, [activeTab]);

  // Issue navigation stack — supports drilling in from Epic → Story → Task
  const [issueNavStack, setIssueNavStack] = useState<Issue[]>([]);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [createIssueStatus, setCreateIssueStatus] = useState('todo');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showAIChatbot, setShowAIChatbot] = useState(false);

  // Search & Filter & Grouping states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{ priorities: string[]; labels: string[] }>({
    priorities: [],
    labels: [],
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterPreset, setFilterPreset] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string>('all');
  const [focusSprint, setFocusSprint] = useState<string>(currentSprintKey());
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [plannedTick, setPlannedTick] = useState(0);
  useEffect(() => {
    const bump = () => setPlannedTick(t => t + 1);
    window.addEventListener(SPRINTS_EVENT, bump);
    return () => window.removeEventListener(SPRINTS_EVENT, bump);
  }, []);
  const projects = useProjects(spaces || []);

  const activeSpace = spaces?.find(s => s.id === activeSpaceId);
  const spaceIssues = useIssuesBySpace(activeSpaceId) || [];
  const allIssues = useAllIssues() || [];
  const spaceSprintKeys = useMemo(() => allSprintKeys(spaceIssues), [spaceIssues, plannedTick]);
  const globalSprintKeys = useMemo(() => allSprintKeys(allIssues), [allIssues, plannedTick]);
  const globalSprintCounts = useMemo(() => {
    const out: Record<string, { done: number; total: number }> = {};
    globalSprintKeys.forEach(k => {
      const s = sprintStats(issuesInSprint(allIssues, k));
      out[k] = { done: s.done, total: s.total };
    });
    return out;
  }, [globalSprintKeys, allIssues]);
  // Board / List / Calendar / Summary see the chosen sprint (epics stay visible so grouping still works)
  const issues = useMemo(
    () => sprintFilter === 'all'
      ? spaceIssues
      : spaceIssues.filter(i => i.type === 'epic' || getIssueSprint(i) === sprintFilter),
    [spaceIssues, sprintFilter]
  );

  // Available labels for current space
  const availableLabels = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => i.labels?.forEach(l => set.add(l)));
    return Array.from(set);
  }, [issues]);

  // Current top of navigation stack
  const selectedIssue = issueNavStack.length > 0 ? issueNavStack[issueNavStack.length - 1] : null;
  const parentIssue = issueNavStack.length > 1 ? issueNavStack[issueNavStack.length - 2] : null;

  useEffect(() => {
    const init = async () => {
      await requestDurableStorage();
      await initLocalDiskSync();
      await stampLegacySprints();
      await syncPendingRoadmaps(); // a changed roadmap schedule reaches its epics and tasks (and stops future sprints from piling up)
      setInitialized(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (spaces && spaces.length > 0) {
      if (activeSpaceId && spaces.some(s => s.id === activeSpaceId)) {
        return;
      }
      const saved = localStorage.getItem('lira_active_space_id');
      const savedSpace = saved ? spaces.find(s => s.id === Number(saved)) : null;
      if (savedSpace?.id) {
        setActiveSpaceId(savedSpace.id);
      } else {
        const certSpace = spaces.find(s => s.key === 'CERT') || spaces[0];
        setActiveSpaceId(certSpace.id);
        localStorage.setItem('lira_active_space_id', String(certSpace.id));
      }
    }
  }, [spaces, activeSpaceId]);

  const openIssue = useCallback((issue: Issue) => {
    setIssueNavStack([issue]);
  }, []);

  const navigateToIssue = useCallback((issue: Issue) => {
    setIssueNavStack(prev => {
      const existingIdx = prev.findIndex(i => i.id === issue.id);
      if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
      return [...prev, issue];
    });
  }, []);

  // Deleting a project removes it and its saved settings and team; its tickets stay in the space
  const handleDeleteProject = useCallback((projectId: string) => {
    try {
      const raw = localStorage.getItem('lira_projects');
      if (raw) writeProjects((JSON.parse(raw) as Project[]).filter(p => p.id !== projectId));
      localStorage.removeItem(`lira_project_settings_${projectId}`);
      localStorage.removeItem(`lira_scope_team:project:${projectId}`);
    } catch (e) {
      console.error('Failed to remove project', e);
    }
    setSelectedProject(prev => (prev?.id === projectId ? null : prev));
  }, []);

  const closeModal = useCallback(() => {
    setIssueNavStack([]);
  }, []);

  // Ticket creation context: which sprint to preselect, and whether the user must pick a space
  const [createIssueSprint, setCreateIssueSprint] = useState<string | undefined>(undefined);
  const [createIssueSpaceId, setCreateIssueSpaceId] = useState<number | undefined>(undefined);
  const [createIssueChooseSpace, setCreateIssueChooseSpace] = useState(false);

  // Other components (e.g. the standup popup) ask the app to open a ticket via a window event
  useEffect(() => {
    const onOpen = (e: Event) => {
      const issue = (e as CustomEvent<Issue>).detail;
      if (issue) openIssue(issue);
    };
    window.addEventListener('lira-open-issue', onOpen);
    return () => window.removeEventListener('lira-open-issue', onOpen);
  }, [openIssue]);

  const handleAddIssue = useCallback((status: string, opts?: { sprint?: string; spaceId?: number; chooseSpace?: boolean }) => {
    setCreateIssueStatus(status);
    setCreateIssueSprint(opts?.sprint);
    setCreateIssueSpaceId(opts?.spaceId);
    setCreateIssueChooseSpace(!!opts?.chooseSpace);
    setShowCreateIssue(true);
  }, []);

  // Filter preset handler from TopNav: navigates to Filters page and applies preset
  const handleApplyFilter = useCallback((preset: string) => {
    setFilterPreset(preset);
    setActiveTab('Filters');
  }, []);

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-jira-bg">
        <div className="text-center space-y-3">
          <img src="/lira-logo.png" alt="Lira Logo" className="w-16 h-16 mx-auto animate-pulse object-contain" />
          <p className="text-jira-muted text-sm font-medium">Initializing Lira v2.0…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app-frame font-sans">
      <TopNavigation
        onCreateIssue={() => handleAddIssue('todo', { chooseSpace: true })}
        onToggleAI={() => setShowAIChatbot(v => !v)}
        issues={allIssues.length > 0 ? allIssues : issues}
        spaces={spaces || []}
        onSelectIssue={openIssue}
        onApplyFilter={handleApplyFilter}
        onNavigateToFilters={() => setActiveTab('Filters')}
        onNavigateToProjects={() => {
          setSelectedProject(null);
          setActiveTab('Projects');
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          spaces={spaces || []}
          activeSpaceId={activeSpaceId}
          onSpaceSelect={handleSelectSpace}
          onCreateSpace={() => setShowCreateSpace(true)}
          onNavigateToFilters={() => setActiveTab('Filters')}
          onNavigateToDashboards={() => setActiveTab('Summary')}
          onNavigateToTeams={() => setActiveTab('Capacity')}
          onNavigateToList={() => setActiveTab('List')}
          onNavigateToCalendar={() => setActiveTab('Calendar')}
          onNavigateToProjects={() => {
            setSelectedProject(null);
            setActiveTab('Projects');
          }}
          onNavigateToSprints={() => setActiveTab('SprintsHub')}
          onNavigateToRoadmaps={() => { setActiveTab('Roadmaps'); window.dispatchEvent(new Event('lira-roadmaps-home')); }}
          onNavigateToForYou={() => setActiveTab('ForYou')}
          onNavigateToAllTickets={() => setActiveTab('AllTickets')}
          projects={projects}
          activeProjectId={selectedProject?.id}
          onSelectProject={(project) => {
            setSelectedProject(project);
            setActiveTab('Projects');
          }}
          onCreateProject={() => setShowCreateProject(true)}
          sprintKeys={globalSprintKeys}
          sprintCounts={globalSprintCounts}
          activeSprint={focusSprint}
          onSelectSprint={(key) => {
            setFocusSprint(key);
            setActiveTab('SprintDetail');
          }}
          onCreateSprint={() => setShowCreateSprint(true)}
          onDeleteProject={project => handleDeleteProject(project.id)}
          onDeleteSprint={key => { void deleteSprint(key, allIssues); if (focusSprint === key && activeTab === 'SprintDetail') setActiveTab('SprintsHub'); }}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hiddenSpaceIds={hiddenSpaceIds}
          archivedSpaceIds={archivedSpaceIds}
          onToggleHideSpace={toggleHideSpace}
          onToggleArchiveSpace={toggleArchiveSpace}
          onUnhideAllSpaces={unhideAllSpaces}
          onEditSpace={(space) => {
            setEditingSpace(space);
            setShowCreateSpace(true);
          }}
        />

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden my-2 mr-2 ml-2 rounded-2xl border border-jira-border bg-jira-bg shadow-[0_4px_20px_rgba(9,30,66,0.10)]">
          {activeTab === 'Filters' ? (
            <FiltersPage
              issues={allIssues.length > 0 ? allIssues : issues}
              spaces={spaces || []}
              onSelectIssue={openIssue}
              onSelectSpace={(spaceId) => {
                handleSelectSpace(spaceId);
                setActiveTab('Board');
                setSidebarCollapsed(false);
              }}
              onBackToBoard={() => {
                setActiveTab('Board');
                setSidebarCollapsed(false);
              }}
              initialPreset={filterPreset}
              onClearPreset={() => setFilterPreset(null)}
            />
          ) : activeTab === 'ForYou' ? (
            <ForYouPage
              spaces={spaces || []}
              issues={allIssues}
              projects={projects}
              onIssueClick={openIssue}
              onOpenSpace={(spaceId) => { handleSelectSpace(spaceId); setActiveTab('Board'); }}
              onOpenProject={(project) => { setSelectedProject(project); setActiveTab('Projects'); }}
              onOpenSprint={(key) => { setFocusSprint(key); setActiveTab('SprintDetail'); }}
              onCreateIssue={() => handleAddIssue('todo', { chooseSpace: true })}
            />
          ) : activeTab === 'Roadmaps' ? (
            <RoadmapsPage issues={allIssues} spaces={spaces || []} />
          ) : activeTab === 'SprintsHub' ? (
            <SprintsOverview
              spaces={spaces || []}
              issues={allIssues}
              onOpenSprint={(key) => { setFocusSprint(key); setActiveTab('SprintDetail'); }}
              onCreateSprint={() => setShowCreateSprint(true)}
              onOpenAllTickets={() => setActiveTab('AllTickets')}
            />
          ) : activeTab === 'SprintDetail' ? (
            <SprintsPage
              spaces={spaces || []}
              issues={allIssues}
              onIssueClick={openIssue}
              onAddIssue={(status, opts) =>
                handleAddIssue(status, { ...opts, chooseSpace: !opts?.spaceId })
              }
              onOpenAllTickets={() => setActiveTab('AllTickets')}
              focusSprint={focusSprint}
              onBack={() => setActiveTab('SprintsHub')}
              onCreateSprint={() => setShowCreateSprint(true)}
              onOpenSpace={(spaceId) => {
                handleSelectSpace(spaceId);
                setActiveTab('Board');
              }}
            />
          ) : activeTab === 'AllTickets' ? (
            <AllTicketsPage
              spaces={spaces || []}
              issues={allIssues}
              onIssueClick={openIssue}
              onOpenSprints={() => setActiveTab('SprintsHub')}
            />
          ) : activeTab === 'Projects' ? (
            selectedProject ? (
              <ProjectDetailView
                project={selectedProject}
                space={spaces?.find(s => s.id === selectedProject.spaceId) || spaces?.find(s => s.key === selectedProject.key)}
                issues={allIssues.length > 0 ? allIssues : issues}
                onBack={() => setSelectedProject(null)}
                onUpdateProject={(updated) => setSelectedProject(updated)}
                onDeleteProject={handleDeleteProject}
                onIssueClick={openIssue}
                onAddIssue={handleAddIssue}
                onSwitchToSpace={(spaceId) => {
                  handleSelectSpace(spaceId);
                  setActiveTab('Board');
                }}
              />
            ) : (
              <ProjectsOverview
                spaces={spaces || []}
                issues={allIssues.length > 0 ? allIssues : issues}
                onSelectProject={(project) => setSelectedProject(project)}
                onSelectSpace={(spaceId) => {
                  handleSelectSpace(spaceId);
                  setActiveTab('Board');
                }}
                onIssueClick={openIssue}
                onAddIssue={handleAddIssue}
              />
            )
          ) : activeSpaceId ? (
            <>
              <BoardActionBar
                space={activeSpace}
                issues={issues}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterAssignee={filterAssignee}
                onFilterAssigneeToggle={() => setFilterAssignee(f => !f)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onFilterChange={setActiveFilters}
                onGroupChange={setGroupBy}
                onClearFilters={() => setActiveFilters({ priorities: [], labels: [] })}
                availableLabels={availableLabels}
                onMaximize={() => setSidebarCollapsed(true)}
                isSpaceHidden={activeSpaceId ? hiddenSpaceIds.includes(activeSpaceId) : false}
                isSpaceArchived={activeSpaceId ? archivedSpaceIds.includes(activeSpaceId) : false}
                onToggleHideSpace={() => activeSpaceId && toggleHideSpace(activeSpaceId)}
                onToggleArchiveSpace={() => activeSpaceId && toggleArchiveSpace(activeSpaceId)}
                onEditSpace={() => {
                  if (activeSpace) {
                    setEditingSpace(activeSpace);
                    setShowCreateSpace(true);
                  }
                }}
              />

              {['Board', 'List', 'Calendar', 'Summary'].includes(activeTab) && (
                <SprintFilterBar
                  value={sprintFilter}
                  options={spaceSprintKeys}
                  onChange={setSprintFilter}
                  onManage={() => setActiveTab('Sprints')}
                />
              )}

              {activeTab === 'Sprints' && (
                <SprintsPage
                  key={activeSpaceId}
                  spaces={spaces || []}
                  issues={allIssues}
                  lockedSpaceId={activeSpaceId}
                  onIssueClick={openIssue}
                  onAddIssue={handleAddIssue}
                  onOpenAllTickets={() => setActiveTab('AllTickets')}
                />
              )}

              {activeTab === 'Board' && (
                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  <KanbanBoard
                    issues={issues}
                    space={activeSpace}
                    searchQuery={searchQuery}
                    filterAssignee={filterAssignee}
                    onIssueClick={openIssue}
                    onAddIssue={handleAddIssue}
                    activeFilters={activeFilters}
                    groupBy={groupBy}
                  />
                </div>
              )}

              {activeTab === 'List' && (
                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  <ListView
                    issues={issues}
                    space={activeSpace}
                    onSelectIssue={openIssue}
                    searchQuery={searchQuery}
                    activeFilters={activeFilters}
                  />
                </div>
              )}

              {activeTab === 'Calendar' && (
                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  <CalendarView
                    issues={issues}
                    space={activeSpace}
                    onSelectIssue={openIssue}
                  />
                </div>
              )}

              {activeTab === 'Summary' && (
                <SummaryView
                  issues={issues}
                  space={activeSpace}
                  onIssueClick={openIssue}
                />
              )}

              {activeTab === 'Capacity' && (
                <CapacityView
                  issues={issues}
                  space={activeSpace}
                  onIssueClick={openIssue}
                  searchQuery={searchQuery}
                  filterAssignee={filterAssignee}
                  activeFilters={activeFilters}
                  groupBy={groupBy}
                />
              )}

              {activeTab !== 'Board' && activeTab !== 'List' && activeTab !== 'Calendar' && activeTab !== 'Summary' && activeTab !== 'Capacity' && activeTab !== 'Sprints' && (
                <div className="flex-1 flex items-center justify-center bg-jira-bg">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">🚧</div>
                    <p className="text-jira-muted text-sm font-medium">{activeTab} view — coming soon</p>
                    <button onClick={() => setActiveTab('Board')} className="text-jira-blue text-sm hover:underline cursor-pointer">
                      Back to Board
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md px-4">
                <img src="/lira-full-logo.png" alt="Lira - Learner's Jira Workspace" className="h-20 mx-auto object-contain drop-shadow-sm" />
                <p className="text-jira-muted text-sm">Select a space or create one to get started.</p>
                <button onClick={() => setShowCreateSpace(true)} className="px-5 py-2.5 bg-jira-blue text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
                  Create your first space
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Issue detail modal */}
      <ErrorBoundary
        fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeModal}>
            <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-modal">
              <p className="text-lg font-semibold text-jira-text mb-2">Failed to render this issue</p>
              <p className="text-sm text-jira-muted mb-4">There was an error displaying the issue details.</p>
              <button onClick={closeModal} className="px-4 py-2 bg-jira-blue text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedIssue && (
          <IssueDetailModal
            issue={selectedIssue}
            parentIssue={parentIssue}
            onClose={closeModal}
            onNavigateToIssue={navigateToIssue}
          />
        )}
      </ErrorBoundary>

      <CreateIssueModal
        isOpen={showCreateIssue}
        onClose={() => setShowCreateIssue(false)}
        space={
          createIssueSpaceId
            ? (spaces?.find(s => s.id === createIssueSpaceId) || activeSpace)
            : activeTab === 'Projects' && selectedProject
              ? (spaces?.find(s => s.id === selectedProject.spaceId) || activeSpace)
              : activeSpace
        }
        spaces={spaces || []}
        chooseSpace={createIssueChooseSpace}
        defaultSprint={createIssueSprint}
        defaultStatus={createIssueStatus}
      />

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        existingKeys={globalSprintKeys}
        onCreated={(key) => {
          setFocusSprint(key);
          setActiveTab('SprintDetail');
        }}
      />

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        spaces={spaces || []}
        onProjectCreated={(project) => {
          setSelectedProject(project);
          setActiveTab('Projects');
        }}
      />

      <CreateSpaceModal
        isOpen={showCreateSpace}
        editingSpace={editingSpace}
        onClose={() => {
          setShowCreateSpace(false);
          setEditingSpace(null);
        }}
        onCreated={(id: number) => handleSelectSpace(id)}
      />

      {/* Viva AI — bottom-right chatbot with full read & write access */}
      <VivaAIChatbot
        isOpen={showAIChatbot}
        onClose={() => setShowAIChatbot(false)}
        onToggle={() => setShowAIChatbot(v => !v)}
        activeSpace={activeSpace}
        spaces={spaces || []}
        onSelectIssue={openIssue}
      />
    </div>
  );
}
