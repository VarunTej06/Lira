import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { NotFound, PageBoundary } from './components/common/PageBoundary';
import { NoSpaces } from './components/common/AppPages';
import { PageSkeleton } from './components/common/Skeleton';
import { SpaceView } from './components/space/SpaceView';

// Every page except the board is fetched when it is first opened, so the first load stays small
const DashboardsPage = lazy(() => import('./components/dashboards/DashboardsPage').then(m => ({ default: m.DashboardsPage })));
const FiltersPage = lazy(() => import('./components/filter/FiltersPage').then(m => ({ default: m.FiltersPage })));
const ProjectsOverview = lazy(() => import('./components/projects/ProjectsOverview').then(m => ({ default: m.ProjectsOverview })));
const ProjectDetailView = lazy(() => import('./components/projects/ProjectDetailView').then(m => ({ default: m.ProjectDetailView })));
const SprintsPage = lazy(() => import('./components/sprints/SprintsPage').then(m => ({ default: m.SprintsPage })));
const SprintsOverview = lazy(() => import('./components/sprints/SprintsOverview').then(m => ({ default: m.SprintsOverview })));
const ForYouPage = lazy(() => import('./components/foryou/ForYouPage').then(m => ({ default: m.ForYouPage })));
const AllTicketsPage = lazy(() => import('./components/sprints/AllTicketsPage').then(m => ({ default: m.AllTicketsPage })));
const RoadmapsRoute = lazy(() => import('./components/roadmap/RoadmapsRoute').then(m => ({ default: m.RoadmapsRoute })));
import { spacePath, type AppRoute } from './routes';
import type { Project } from './types/project';
import type { Space } from './types/space';
import type { Issue } from './types/issue';

// Once the first screen is showing, the other pages are fetched quietly, so opening them one after another does not wait on the network
const PAGE_LOADERS = [
  () => import('./components/dashboards/DashboardsPage'), () => import('./components/filter/FiltersPage'),
  () => import('./components/projects/ProjectsOverview'), () => import('./components/projects/ProjectDetailView'),
  () => import('./components/sprints/SprintsPage'), () => import('./components/sprints/SprintsOverview'),
  () => import('./components/foryou/ForYouPage'), () => import('./components/sprints/AllTicketsPage'),
  () => import('./components/roadmap/RoadmapsRoute'),
];

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
  useEffect(() => {
    const id = window.setTimeout(() => PAGE_LOADERS.forEach(load => { void load(); }), 1200);
    return () => window.clearTimeout(id);
  }, []);
  const { route, spaceList, activeSpace, routeSpace, allIssues, everyIssue, issues, selectedProject } = p;
  return (
  <PageBoundary pageKey={p.pageKey}>
    <Suspense fallback={<PageSkeleton />}>
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
    </Suspense>
  </PageBoundary>
  );
}
