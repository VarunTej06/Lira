import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { DashboardsPage } from './components/dashboards/DashboardsPage';
import { FiltersPage } from './components/filter/FiltersPage';
import { ProjectsOverview } from './components/projects/ProjectsOverview';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { NotFound, PageBoundary } from './components/common/PageBoundary';
import { SprintsPage } from './components/sprints/SprintsPage';
import { SprintsOverview } from './components/sprints/SprintsOverview';
import { ForYouPage } from './components/foryou/ForYouPage';
import { NoSpaces, RoadmapsRoute } from './components/common/AppPages';
import { AllTicketsPage } from './components/sprints/AllTicketsPage';
import { SpaceView } from './components/space/SpaceView';
import { spacePath, type AppRoute } from './routes';
import type { Project } from './types/project';
import type { Space } from './types/space';
import type { Issue } from './types/issue';

type AddIssue = (status: string, opts?: { sprint?: string; spaceId?: number; chooseSpace?: boolean }) => void;

interface AppRoutesProps {
  route: AppRoute;
  pageKey: string;
  spaceList: Space[];
  activeSpace: Space | undefined;
  routeSpace: Space | undefined;
  projects: Project[];
  selectedProject: Project | undefined;
  /** Every ticket (empty until loaded), the same or the open space's tickets as a fallback, and the open space's tickets after the sprint filter. */
  allIssues: Issue[];
  everyIssue: Issue[];
  issues: Issue[];
  spaceSprintKeys: string[];
  sprintFilter: string;
  onSprintFilterChange: (sprint: string) => void;
  filterPreset: string | null;
  onClearPreset: () => void;
  hiddenSpaceIds: number[];
  archivedSpaceIds: number[];
  onToggleHide: (id: number) => void;
  onToggleArchive: (id: number) => void;
  onEditSpace: (space: Space) => void;
  onCreateSpace: () => void;
  onCreateSprint: () => void;
  onExpandSidebar: () => void;
  onOpenIssue: (issue: Issue) => void;
  onOpenSpaceBoard: (id: number) => void;
  onAddIssue: AddIssue;
  onDeleteProject: (id: string) => void;
  onTab: (tab: string) => void;
}

/** Every page of the app and the address it lives at. */
export function AppRoutes(p: AppRoutesProps) {
  const navigate = useNavigate();
  const { route, spaceList, activeSpace, routeSpace, allIssues, everyIssue, issues, selectedProject } = p;
  return (
  <PageBoundary pageKey={p.pageKey}>
    <Routes>
      <Route path="/" element={activeSpace
        ? <Navigate to={spacePath(activeSpace.key, 'Board')} replace />
        : <NoSpaces onCreate={() => p.onCreateSpace()} />} />

      <Route path="/filters" element={
        <FiltersPage
          issues={everyIssue}
          spaces={spaceList}
          onSelectIssue={p.onOpenIssue}
          onSelectSpace={p.onOpenSpaceBoard}
          onBackToBoard={() => { p.onExpandSidebar(); if (activeSpace) navigate(spacePath(activeSpace.key, 'Board')); else navigate('/'); }}
          initialPreset={p.filterPreset}
          onClearPreset={() => p.onClearPreset()}
        />} />

      <Route path="/for-you" element={
        <ForYouPage
          spaces={spaceList}
          issues={allIssues}
          projects={p.projects}
          onIssueClick={p.onOpenIssue}
          onOpenSpace={p.onOpenSpaceBoard}
          onOpenProject={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
          onOpenSprint={(key) => navigate(`/sprints/${key}`)}
          onCreateIssue={() => p.onAddIssue('todo', { chooseSpace: true })}
        />} />

      <Route path="/dashboards" element={<DashboardsPage issues={allIssues} spaces={spaceList} onOpenIssue={p.onOpenIssue} />} />
      <Route path="/dashboards/:dashboardId" element={<DashboardsPage issues={allIssues} spaces={spaceList} onOpenIssue={p.onOpenIssue} />} />

      <Route path="/roadmaps" element={<RoadmapsRoute issues={allIssues} spaces={spaceList} />} />
      <Route path="/roadmaps/:roadmapId" element={<RoadmapsRoute issues={allIssues} spaces={spaceList} />} />

      <Route path="/sprints" element={
        <SprintsOverview
          spaces={spaceList}
          issues={allIssues}
          onOpenSprint={(key) => navigate(`/sprints/${key}`)}
          onCreateSprint={() => p.onCreateSprint()}
          onOpenAllTickets={() => navigate('/tickets')}
        />} />
      <Route path="/sprints/:sprintKey" element={
        route.kind === 'sprints' && route.sprintKey ? (
          <SprintsPage
            spaces={spaceList}
            issues={allIssues}
            onIssueClick={p.onOpenIssue}
            onAddIssue={(status, opts) => p.onAddIssue(status, { ...opts, chooseSpace: !opts?.spaceId })}
            onOpenAllTickets={() => navigate('/tickets')}
            focusSprint={route.sprintKey}
            onBack={() => navigate('/sprints')}
            onCreateSprint={() => p.onCreateSprint()}
            onOpenSpace={p.onOpenSpaceBoard}
          />
        ) : <Navigate to="/sprints" replace />} />

      <Route path="/tickets" element={
        <AllTicketsPage spaces={spaceList} issues={allIssues} onIssueClick={p.onOpenIssue} onOpenSprints={() => navigate('/sprints')} />} />

      <Route path="/projects" element={
        <ProjectsOverview
          spaces={spaceList}
          issues={everyIssue}
          onSelectProject={(project) => navigate(`/projects/${encodeURIComponent(project.id)}`)}
          onSelectSpace={p.onOpenSpaceBoard}
          onIssueClick={p.onOpenIssue}
          onAddIssue={p.onAddIssue}
        />} />
      <Route path="/projects/:projectId" element={
        selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            space={spaceList.find(s => s.id === selectedProject.spaceId) || spaceList.find(s => s.key === selectedProject.key)}
            issues={everyIssue}
            onBack={() => navigate('/projects')}
            onUpdateProject={() => { /* projects are saved by the detail view; the list below re-reads them */ }}
            onDeleteProject={p.onDeleteProject}
            onIssueClick={p.onOpenIssue}
            onAddIssue={p.onAddIssue}
            onSwitchToSpace={p.onOpenSpaceBoard}
          />
        ) : <NotFound what="This project" backTo="/projects" backLabel="All projects" />} />

      <Route path="/space/:spaceKey/*" element={
        activeSpace && routeSpace && route.kind === 'space' ? (
          <SpaceView
            space={routeSpace}
            spaces={spaceList}
            tab={route.tab}
            onTabChange={p.onTab}
            issues={issues}
            allIssues={allIssues}
            sprintKeys={p.spaceSprintKeys}
            sprintFilter={p.sprintFilter}
            onSprintFilterChange={p.onSprintFilterChange}
            onIssueClick={p.onOpenIssue}
            onAddIssue={p.onAddIssue}
            onOpenAllTickets={() => navigate('/tickets')}
            isHidden={p.hiddenSpaceIds.includes(routeSpace.id!)}
            isArchived={p.archivedSpaceIds.includes(routeSpace.id!)}
            onToggleHide={() => p.onToggleHide(routeSpace.id!)}
            onToggleArchive={() => p.onToggleArchive(routeSpace.id!)}
            onEditSpace={() => p.onEditSpace(routeSpace)}
          />
        ) : <NotFound what={`The space ${route.kind === 'space' ? route.spaceKey : ''}`} backTo="/" backLabel="Go to your last space" />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </PageBoundary>
  );
}
