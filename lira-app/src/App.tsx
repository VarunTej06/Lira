import { DialogHost } from './components/common/dialogs';
import { DashboardScheduler } from './components/dashboards/DashboardScheduler';
import { SavedToastHost } from './components/common/SavedToast';
import { LinkMenuHost } from './components/common/LinkMenu';
import { getLightPalette, getTheme, paintTheme } from './utils/theme';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { TopNavigation } from './components/layout/TopNavigation';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { IssueDetailModal } from './components/issue/IssueDetailModal';
import { CreateIssueModal } from './components/issue/CreateIssueModal';
import { CreateSpaceModal } from './components/board/CreateSpaceModal';
import { VivaAIChatbot } from './components/ai/VivaAIChatbot';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useIssuePopup } from './hooks/useIssuePopup';
import { CreateSprintModal } from './components/sprints/CreateSprintModal';
import { CreateProjectModal } from './components/projects/CreateProjectModal';
import { allSprintKeys, deleteSprint, getIssueSprint } from './utils/sprintUtils';
import { sprintCounts } from './utils/sprintCounts';
import { spaceForCreate } from './utils/createIssueSpace';
import { useProjects } from './hooks/useProjects';
import { removeProjectData } from './hooks/projectCleanup';
import { useAppStartup } from './hooks/useAppStartup';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useCreateIssueDialog } from './hooks/useCreateIssueDialog';
import { usePlannedSprints } from './hooks/usePlannedSprints';
import { IssueCrashFallback, StartupScreen } from './AppParts';
import { useSpaces } from './hooks/useSpaces';
import { useActiveSpace, useSpacePrefs } from './hooks/useSpacePrefs';
import { useIssuesBySpace, useAllIssues } from './hooks/useIssues';
import { db } from './db/db';
import { parsePath, spacePath, tabOf, titleOf } from './routes';
import type { Project } from './types/project';
import type { Space } from './types/space';
import { useResetWhen } from './hooks/useResetWhen';
import { NO_ISSUES } from './utils/emptyLists';

// Show the saved theme before the first render, so the page never flashes in the wrong colours
if (typeof window !== 'undefined') paintTheme(getTheme(), getLightPalette());

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = useMemo(() => parsePath(location.pathname), [location.pathname]);
  const activeTab = tabOf(route);

  const spaces = useSpaces();
  const initialized = useAppStartup();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // The space shown now comes from the URL (/space/<KEY>/...). On other pages the last space you used is remembered,
  // so "Create" and the sidebar still know where you were.
  const { routeSpace, activeSpace } = useActiveSpace(route, spaces);
  const activeSpaceId = activeSpace?.id;

  useEffect(() => { document.title = `${titleOf(route)} · Lira`; }, [route]);

  // Auto-collapse sidebar when on Filters page
  useResetWhen([route.kind], () => { if (route.kind === 'filters') setSidebarCollapsed(true); });

  const { hiddenSpaceIds, archivedSpaceIds, toggleHideSpace, toggleArchiveSpace, unhideAllSpaces } = useSpacePrefs();
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);

  const { handleSelectSpace, openSpaceBoard, goTab } = useAppNavigation({ route, navigate, spaces, activeSpace, setSidebarCollapsed });

  const createIssue = useCreateIssueDialog();
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [filterPreset, setFilterPreset] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>('all');
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const projects = useProjects(spaces || []);
  const selectedProject: Project | undefined = route.kind === 'projects' && route.projectId ? projects.find(p => p.id === route.projectId) : undefined;

  const spaceIssues = useIssuesBySpace(activeSpaceId) ?? NO_ISSUES;
  const allIssues = useAllIssues() ?? NO_ISSUES;
  const plannedSprints = usePlannedSprints();
  const spaceSprintKeys = useMemo(() => allSprintKeys(spaceIssues, plannedSprints), [spaceIssues, plannedSprints]);
  const globalSprintKeys = useMemo(() => allSprintKeys(allIssues, plannedSprints), [allIssues, plannedSprints]);
  const globalSprintCounts = useMemo(() => sprintCounts(allIssues, globalSprintKeys), [globalSprintKeys, allIssues]);
  // Board / List / Calendar / Summary see the chosen sprint (epics stay visible so grouping still works)
  const issues = useMemo(
    () => sprintFilter === 'all' ? spaceIssues : spaceIssues.filter(i => i.type === 'epic' || getIssueSprint(i) === sprintFilter),
    [spaceIssues, sprintFilter]
  );
  const everyIssue = allIssues.length > 0 ? allIssues : issues;

  // The ticket popup lives in the URL (?issue=LIRA-12)
  const { selectedIssue, parentIssue, openIssue, navigateToIssue, closeModal } = useIssuePopup(allIssues);

  // Deleting a project removes it and its saved settings and team; its tickets stay in the space
  const handleDeleteProject = useCallback((projectId: string) => {
    if (!removeProjectData(projectId)) console.error('Failed to remove project');
    if (route.kind === 'projects' && route.projectId === projectId) navigate('/projects');
  }, [route, navigate]);

  // Filter preset handler from TopNav: opens the Filters page with the preset applied
  const handleApplyFilter = useCallback((preset: string) => { setFilterPreset(preset); navigate('/filters'); }, [navigate]);

  if (!initialized) return <StartupScreen />;

  const spaceList = spaces || [];
  const pageKey = route.kind === 'space' ? `space:${route.spaceKey}` : route.kind;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app-frame font-sans">
      <TopNavigation
        onCreateIssue={() => createIssue.open('todo', { chooseSpace: true })}
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
          onNavigateToDashboards={() => navigate('/dashboards')}
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

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden my-2 mr-2 ml-2 rounded-2xl border border-lira-border bg-lira-bg shadow-[0_4px_20px_rgba(0,0,0,0.10)]">
          <AppRoutes
            route={route} pageKey={pageKey} spaceList={spaceList} activeSpace={activeSpace} routeSpace={routeSpace}
            projects={projects} selectedProject={selectedProject} allIssues={allIssues} everyIssue={everyIssue} issues={issues}
            spaceSprintKeys={spaceSprintKeys} sprintFilter={sprintFilter} onSprintFilterChange={setSprintFilter}
            filterPreset={filterPreset} onClearPreset={() => setFilterPreset(null)}
            hiddenSpaceIds={hiddenSpaceIds} archivedSpaceIds={archivedSpaceIds} onToggleHide={toggleHideSpace} onToggleArchive={toggleArchiveSpace}
            onEditSpace={space => { setEditingSpace(space); setShowCreateSpace(true); }}
            onCreateSpace={() => setShowCreateSpace(true)} onCreateSprint={() => setShowCreateSprint(true)}
            onExpandSidebar={() => setSidebarCollapsed(false)}
            onOpenIssue={openIssue} onOpenSpaceBoard={openSpaceBoard} onAddIssue={createIssue.open} onDeleteProject={handleDeleteProject} onTab={goTab}
          />
        </main>
      </div>

      <DialogHost />
      <SavedToastHost />
      <LinkMenuHost />
      <DashboardScheduler issues={allIssues} spaces={spaceList} />

      {/* Issue detail modal */}
      <ErrorBoundary fallback={<IssueCrashFallback onClose={closeModal} />}>
        {selectedIssue && (
          <IssueDetailModal issue={selectedIssue} parentIssue={parentIssue} onClose={closeModal} onNavigateToIssue={navigateToIssue} />
        )}
      </ErrorBoundary>

      <CreateIssueModal
        isOpen={createIssue.isOpen}
        onClose={createIssue.close}
        space={spaceForCreate(spaceList, activeSpace, createIssue.spaceId, selectedProject?.spaceId)}
        spaces={spaceList}
        chooseSpace={createIssue.chooseSpace}
        defaultSprint={createIssue.sprint}
        defaultStatus={createIssue.status}
      />

      <CreateSprintModal
        isOpen={showCreateSprint}
        onClose={() => setShowCreateSprint(false)}
        existingKeys={globalSprintKeys}
        spaces={spaceList}
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
