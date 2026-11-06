import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TopNavigation } from './components/layout/TopNavigation';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { FiltersPage } from './components/filter/FiltersPage';
import { IssueDetailModal } from './components/issue/IssueDetailModal';
import { CreateIssueModal } from './components/issue/CreateIssueModal';
import { CreateSpaceModal } from './components/board/CreateSpaceModal';
import { ProjectsOverview } from './components/projects/ProjectsOverview';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { VivaAIChatbot } from './components/ai/VivaAIChatbot';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotFound, PageBoundary } from './components/common/PageBoundary';
import { SprintsPage } from './components/sprints/SprintsPage';
import { SprintsOverview } from './components/sprints/SprintsOverview';
import { ForYouPage } from './components/foryou/ForYouPage';
import { NoSpaces, RoadmapsRoute } from './components/common/AppPages';
import { useIssuePopup } from './hooks/useIssuePopup';
import { AllTicketsPage } from './components/sprints/AllTicketsPage';
import { SpaceView } from './components/space/SpaceView';
import { CreateSprintModal } from './components/sprints/CreateSprintModal';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { syncPendingRoadmaps } from './services/roadmapEpics';
import { allSprintKeys, deleteSprint, getIssueSprint, stampLegacySprints, issuesInSprint, sprintStats, SPRINTS_EVENT } from './utils/sprintUtils';
import { useProjects, writeProjects } from './hooks/useProjects';
import { useSpaces } from './hooks/useSpaces';
import { useIssuesBySpace, useAllIssues } from './hooks/useIssues';
import { db, requestDurableStorage } from './db/db';
import { initLocalDiskSync } from './services/localDiskSync';
import { isGlobalRoute, parsePath, pathFor, routeForTab, spacePath, tabOf, titleOf  } from './routes';
import type {  } from './types/issue';
import type { Project } from './types/project';
import type { Space } from './types/space';

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
  const navigate = useNavigate();
  const location = useLocation();
  const route = useMemo(() => parsePath(location.pathname), [location.pathname]);
  const activeTab = tabOf(route);

  const spaces = useSpaces();
  const [initialized, setInitialized] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // The space shown now comes from the URL (/space/<KEY>/...). When you are on another page, the last space you used
  // is remembered, so "Create" and the sidebar still know where you were.
  const routeSpace = route.kind === 'space' ? spaces?.find(s => s.key.toUpperCase() === route.spaceKey) : undefined;
  const [lastSpaceId, setLastSpaceId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('lira_active_space_id');
    return saved ? Number(saved) : undefined;
  });
  useEffect(() => {
    if (routeSpace?.id && routeSpace.id !== lastSpaceId) {
      setLastSpaceId(routeSpace.id);
      localStorage.setItem('lira_active_space_id', String(routeSpace.id));
    }
  }, [routeSpace, lastSpaceId]);
  useEffect(() => {
    if (!spaces || spaces.length === 0 || (lastSpaceId && spaces.some(s => s.id === lastSpaceId))) return;
    const fallback = spaces.find(s => s.key === 'CERT') || spaces[0];
    setLastSpaceId(fallback.id);
    localStorage.setItem('lira_active_space_id', String(fallback.id));
  }, [spaces, lastSpaceId]);
  const activeSpace: Space | undefined = routeSpace ?? spaces?.find(s => s.id === lastSpaceId);
  const activeSpaceId = activeSpace?.id;

  // Apply lira_theme on app mount immediately
  useEffect(() => {
    const savedTheme = localStorage.getItem('lira_theme');
    if (savedTheme === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => { document.title = `${titleOf(route)} · Lira`; }, [route]);

  // Auto-collapse sidebar when on Filters page
  useEffect(() => { if (route.kind === 'filters') setSidebarCollapsed(true); }, [route.kind]);

  // Hidden and Archived spaces states persisted to localStorage
  const [hiddenSpaceIds, setHiddenSpaceIds] = useState<number[]>(() => {
    try { const saved = localStorage.getItem('lira_hidden_spaces'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [archivedSpaceIds, setArchivedSpaceIds] = useState<number[]>(() => {
    try { const saved = localStorage.getItem('lira_archived_spaces'); return saved ? JSON.parse(saved) : []; } catch { return []; }
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

  // Going to a space: keep the tab you are on when already inside a space, otherwise open its board
  const goToSpace = useCallback((space: Space) => {
    const keepTab = route.kind === 'space' ? route.tab : 'Board';
    if (isGlobalRoute(route)) setSidebarCollapsed(false);
    navigate(spacePath(space.key, keepTab));
  }, [route, navigate]);
  const handleSelectSpace = useCallback((id: number) => {
    const space = spaces?.find(s => s.id === id);
    if (space) goToSpace(space);
  }, [spaces, goToSpace]);
  const openSpaceBoard = useCallback((id: number) => {
    const space = spaces?.find(s => s.id === id);
    if (space) { setSidebarCollapsed(false); navigate(spacePath(space.key, 'Board')); }
  }, [spaces, navigate]);

  // Page names (used by the board tabs and the sidebar) become routes
  const goTab = useCallback((tab: string) => {
    navigate(pathFor(routeForTab(tab, {
      spaceKey: activeSpace?.key,
      projectId: route.kind === 'projects' ? route.projectId : undefined,
      sprintKey: route.kind === 'sprints' ? route.sprintKey : undefined,
      roadmapId: route.kind === 'roadmaps' ? route.roadmapId : undefined,
    })));
  }, [navigate, activeSpace, route]);

  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [createIssueStatus, setCreateIssueStatus] = useState('todo');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [filterPreset, setFilterPreset] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>('all');
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [plannedTick, setPlannedTick] = useState(0);
  useEffect(() => {
    const bump = () => setPlannedTick(t => t + 1);
    window.addEventListener(SPRINTS_EVENT, bump);
    return () => window.removeEventListener(SPRINTS_EVENT, bump);
  }, []);

  const projects = useProjects(spaces || []);
  const selectedProject: Project | undefined = route.kind === 'projects' && route.projectId ? projects.find(p => p.id === route.projectId) : undefined;

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
    () => sprintFilter === 'all' ? spaceIssues : spaceIssues.filter(i => i.type === 'epic' || getIssueSprint(i) === sprintFilter),
    [spaceIssues, sprintFilter]
  );
  const everyIssue = allIssues.length > 0 ? allIssues : issues;

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

  // The ticket popup lives in the URL (?issue=LIRA-12)
  const { selectedIssue, parentIssue, openIssue, navigateToIssue, closeModal } = useIssuePopup(allIssues);

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
    if (route.kind === 'projects' && route.projectId === projectId) navigate('/projects');
  }, [route, navigate]);

  // Ticket creation context: which sprint to preselect, and whether the user must pick a space
  const [createIssueSprint, setCreateIssueSprint] = useState<string | undefined>(undefined);
  const [createIssueSpaceId, setCreateIssueSpaceId] = useState<number | undefined>(undefined);
  const [createIssueChooseSpace, setCreateIssueChooseSpace] = useState(false);
  const handleAddIssue = useCallback((status: string, opts?: { sprint?: string; spaceId?: number; chooseSpace?: boolean }) => {
    setCreateIssueStatus(status);
    setCreateIssueSprint(opts?.sprint);
    setCreateIssueSpaceId(opts?.spaceId);
    setCreateIssueChooseSpace(!!opts?.chooseSpace);
    setShowCreateIssue(true);
  }, []);

  // Filter preset handler from TopNav: opens the Filters page with the preset applied
  const handleApplyFilter = useCallback((preset: string) => { setFilterPreset(preset); navigate('/filters'); }, [navigate]);

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

  const spaceList = spaces || [];
  const goSpaceTab = (tab: string) => { if (activeSpace) navigate(spacePath(activeSpace.key, tab)); };
  const pageKey = route.kind === 'space' ? `space:${route.spaceKey}` : route.kind;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app-frame font-sans">
      <TopNavigation
        onCreateIssue={() => handleAddIssue('todo', { chooseSpace: true })}
        onToggleAI={() => setShowAIChatbot(v => !v)}
        issues={everyIssue}
        spaces={spaceList}
        onSelectIssue={openIssue}
        onApplyFilter={handleApplyFilter}
        onNavigateToFilters={() => navigate('/filters')}
        onNavigateToProjects={() => navigate('/projects')}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          spaces={spaceList}
          activeSpaceId={activeSpaceId}
          onSpaceSelect={handleSelectSpace}
          onCreateSpace={() => setShowCreateSpace(true)}
          onNavigateToDashboards={() => goSpaceTab('Summary')}
          onNavigateToProjects={() => navigate('/projects')}
          onNavigateToSprints={() => navigate('/sprints')}
          onNavigateToRoadmaps={() => navigate('/roadmaps')}
          onNavigateToForYou={() => navigate('/for-you')}
          onNavigateToAllTickets={() => navigate('/tickets')}
          projects={projects}
          activeProjectId={route.kind === 'projects' ? route.projectId : undefined}
          onSelectProject={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
          onCreateProject={() => setShowCreateProject(true)}
          sprintKeys={globalSprintKeys}
          sprintCounts={globalSprintCounts}
          activeSprint={route.kind === 'sprints' ? route.sprintKey : undefined}
          onSelectSprint={(key) => navigate(`/sprints/${key}`)}
          onCreateSprint={() => setShowCreateSprint(true)}
          onDeleteProject={project => handleDeleteProject(project.id)}
          onDeleteSprint={key => { void deleteSprint(key, allIssues); if (route.kind === 'sprints' && route.sprintKey === key) navigate('/sprints'); }}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          activeTab={activeTab}
          hiddenSpaceIds={hiddenSpaceIds}
          archivedSpaceIds={archivedSpaceIds}
          onToggleHideSpace={toggleHideSpace}
          onToggleArchiveSpace={toggleArchiveSpace}
          onUnhideAllSpaces={unhideAllSpaces}
          onEditSpace={(space) => { setEditingSpace(space); setShowCreateSpace(true); }}
        />

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden my-2 mr-2 ml-2 rounded-2xl border border-jira-border bg-jira-bg shadow-[0_4px_20px_rgba(9,30,66,0.10)]">
          <PageBoundary pageKey={pageKey}>
            <Routes>
              <Route path="/" element={activeSpace
                ? <Navigate to={spacePath(activeSpace.key, 'Board')} replace />
                : <NoSpaces onCreate={() => setShowCreateSpace(true)} />} />

              <Route path="/filters" element={
                <FiltersPage
                  issues={everyIssue}
                  spaces={spaceList}
                  onSelectIssue={openIssue}
                  onSelectSpace={openSpaceBoard}
                  onBackToBoard={() => { setSidebarCollapsed(false); if (activeSpace) navigate(spacePath(activeSpace.key, 'Board')); else navigate('/'); }}
                  initialPreset={filterPreset}
                  onClearPreset={() => setFilterPreset(null)}
                />} />

              <Route path="/for-you" element={
                <ForYouPage
                  spaces={spaceList}
                  issues={allIssues}
                  projects={projects}
                  onIssueClick={openIssue}
                  onOpenSpace={openSpaceBoard}
                  onOpenProject={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
                  onOpenSprint={(key) => navigate(`/sprints/${key}`)}
                  onCreateIssue={() => handleAddIssue('todo', { chooseSpace: true })}
                />} />

              <Route path="/roadmaps" element={<RoadmapsRoute issues={allIssues} spaces={spaceList} />} />
              <Route path="/roadmaps/:roadmapId" element={<RoadmapsRoute issues={allIssues} spaces={spaceList} />} />

              <Route path="/sprints" element={
                <SprintsOverview
                  spaces={spaceList}
                  issues={allIssues}
                  onOpenSprint={(key) => navigate(`/sprints/${key}`)}
                  onCreateSprint={() => setShowCreateSprint(true)}
                  onOpenAllTickets={() => navigate('/tickets')}
                />} />
              <Route path="/sprints/:sprintKey" element={
                route.kind === 'sprints' && route.sprintKey ? (
                  <SprintsPage
                    spaces={spaceList}
                    issues={allIssues}
                    onIssueClick={openIssue}
                    onAddIssue={(status, opts) => handleAddIssue(status, { ...opts, chooseSpace: !opts?.spaceId })}
                    onOpenAllTickets={() => navigate('/tickets')}
                    focusSprint={route.sprintKey}
                    onBack={() => navigate('/sprints')}
                    onCreateSprint={() => setShowCreateSprint(true)}
                    onOpenSpace={openSpaceBoard}
                  />
                ) : <Navigate to="/sprints" replace />} />

              <Route path="/tickets" element={
                <AllTicketsPage spaces={spaceList} issues={allIssues} onIssueClick={openIssue} onOpenSprints={() => navigate('/sprints')} />} />

              <Route path="/projects" element={
                <ProjectsOverview
                  spaces={spaceList}
                  issues={everyIssue}
                  onSelectProject={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
                  onSelectSpace={openSpaceBoard}
                  onIssueClick={openIssue}
                  onAddIssue={handleAddIssue}
                />} />
              <Route path="/projects/:projectId" element={
                selectedProject ? (
                  <ProjectDetailView
                    project={selectedProject}
                    space={spaceList.find(s => s.id === selectedProject.spaceId) || spaceList.find(s => s.key === selectedProject.key)}
                    issues={everyIssue}
                    onBack={() => navigate('/projects')}
                    onUpdateProject={() => { /* projects are saved by the detail view; the list below re-reads them */ }}
                    onDeleteProject={handleDeleteProject}
                    onIssueClick={openIssue}
                    onAddIssue={handleAddIssue}
                    onSwitchToSpace={openSpaceBoard}
                  />
                ) : <NotFound what="This project" backTo="/projects" backLabel="All projects" />} />

              <Route path="/space/:spaceKey/*" element={
                activeSpace && routeSpace && route.kind === 'space' ? (
                  <SpaceView
                    space={routeSpace}
                    spaces={spaceList}
                    tab={route.tab}
                    onTabChange={goTab}
                    issues={issues}
                    allIssues={allIssues}
                    sprintKeys={spaceSprintKeys}
                    sprintFilter={sprintFilter}
                    onSprintFilterChange={setSprintFilter}
                    onIssueClick={openIssue}
                    onAddIssue={handleAddIssue}
                    onOpenAllTickets={() => navigate('/tickets')}
                    onMaximize={() => setSidebarCollapsed(true)}
                    isHidden={hiddenSpaceIds.includes(routeSpace.id!)}
                    isArchived={archivedSpaceIds.includes(routeSpace.id!)}
                    onToggleHide={() => toggleHideSpace(routeSpace.id!)}
                    onToggleArchive={() => toggleArchiveSpace(routeSpace.id!)}
                    onEditSpace={() => { setEditingSpace(routeSpace); setShowCreateSpace(true); }}
                  />
                ) : <NotFound what={`The space ${route.kind === 'space' ? route.spaceKey : ''}`} backTo="/" backLabel="Go to your last space" />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageBoundary>
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
          <IssueDetailModal issue={selectedIssue} parentIssue={parentIssue} onClose={closeModal} onNavigateToIssue={navigateToIssue} />
        )}
      </ErrorBoundary>

      <CreateIssueModal
        isOpen={showCreateIssue}
        onClose={() => setShowCreateIssue(false)}
        space={
          createIssueSpaceId
            ? (spaceList.find(s => s.id === createIssueSpaceId) || activeSpace)
            : selectedProject
              ? (spaceList.find(s => s.id === selectedProject.spaceId) || activeSpace)
              : activeSpace
        }
        spaces={spaceList}
        chooseSpace={createIssueChooseSpace}
        defaultSprint={createIssueSprint}
        defaultStatus={createIssueStatus}
      />

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        existingKeys={globalSprintKeys}
        onCreated={(key) => navigate(`/sprints/${key}`)}
      />

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        spaces={spaceList}
        onProjectCreated={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
      />

      <CreateSpaceModal
        isOpen={showCreateSpace}
        editingSpace={editingSpace}
        onClose={() => { setShowCreateSpace(false); setEditingSpace(null); }}
        onCreated={async (id: number) => {
          const created = await db.spaces.get(id); // the space list may not have caught up yet
          if (created) { setSidebarCollapsed(false); navigate(spacePath(created.key, 'Board')); }
        }}
      />

      {/* Viva AI — bottom-right chatbot with full read & write access */}
      <VivaAIChatbot
        isOpen={showAIChatbot}
        onClose={() => setShowAIChatbot(false)}
        onToggle={() => setShowAIChatbot(v => !v)}
        activeSpace={activeSpace}
        spaces={spaceList}
        onSelectIssue={openIssue}
      />
    </div>
  );
}
