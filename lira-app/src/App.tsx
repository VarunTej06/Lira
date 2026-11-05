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
import { LiraInfoChatbot } from './components/ai/LiraInfoChatbot';
import { LiraAIAgentConsole } from './components/ai/LiraAIAgentConsole';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useSpaces } from './hooks/useSpaces';
import { useIssuesBySpace, useAllIssues } from './hooks/useIssues';
import { requestDurableStorage } from './db/db';
import { initLocalDiskSync } from './services/localDiskSync';
import type { Issue } from './types/issue';
import type { Project } from './types/project';
import type { Space } from './types/space';

type GroupBy = 'status' | 'assignee' | 'priority' | 'epic';

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
    if (activeTab === 'Projects' || activeTab === 'Filters') {
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
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [pendingAgentPrompt, setPendingAgentPrompt] = useState<string | null>(null);

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

  const activeSpace = spaces?.find(s => s.id === activeSpaceId);
  const issues = useIssuesBySpace(activeSpaceId) || [];
  const allIssues = useAllIssues() || [];

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

  const closeModal = useCallback(() => {
    setIssueNavStack([]);
  }, []);

  const handleAddIssue = useCallback((status: string) => {
    setCreateIssueStatus(status);
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
    <div className="h-screen flex flex-col overflow-hidden bg-jira-bg font-sans">
      <TopNavigation
        onCreateIssue={() => setShowCreateIssue(true)}
        onToggleAI={() => setShowAIAgent(v => !v)}
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

        <main className="flex-1 flex flex-col overflow-hidden">
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
          ) : activeTab === 'Projects' ? (
            selectedProject ? (
              <ProjectDetailView
                project={selectedProject}
                space={spaces?.find(s => s.id === selectedProject.spaceId) || spaces?.find(s => s.key === selectedProject.key)}
                issues={allIssues.length > 0 ? allIssues : issues}
                onBack={() => setSelectedProject(null)}
                onUpdateProject={(updated) => setSelectedProject(updated)}
                onDeleteProject={(projectId) => {
                  try {
                    const raw = localStorage.getItem('lira_projects');
                    if (raw) {
                      const list: Project[] = JSON.parse(raw);
                      localStorage.setItem('lira_projects', JSON.stringify(list.filter(p => p.id !== projectId)));
                    }
                  } catch (e) {
                    console.error('Failed to remove project from localStorage', e);
                  }
                  setSelectedProject(null);
                }}
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

              {activeTab !== 'Board' && activeTab !== 'List' && activeTab !== 'Calendar' && activeTab !== 'Summary' && activeTab !== 'Capacity' && (
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
        space={activeTab === 'Projects' && selectedProject ? (spaces?.find(s => s.id === selectedProject.spaceId) || activeSpace) : activeSpace}
        defaultStatus={createIssueStatus}
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

      {/* 1. Bottom-Right Floating Avatar & Curved Dialogue (Read-Only Info Chatbot) */}
      <LiraInfoChatbot
        isOpen={showAIChatbot}
        onClose={() => setShowAIChatbot(false)}
        onToggle={() => setShowAIChatbot(v => !v)}
        onOpenAgent={(prompt) => {
          setShowAIChatbot(false);
          if (prompt) setPendingAgentPrompt(prompt);
          setShowAIAgent(true);
        }}
        activeSpace={activeSpace}
        spaces={spaces || []}
        onSelectIssue={openIssue}
      />

      {/* 2. Top-Nav Pro Autonomous Agent Drawer (Full Read/Write, System Instructions, Gemini LLM) */}
      <LiraAIAgentConsole
        isOpen={showAIAgent}
        onClose={() => setShowAIAgent(false)}
        activeSpace={activeSpace}
        spaces={spaces || []}
        initialPrompt={pendingAgentPrompt}
        onClearInitialPrompt={() => setPendingAgentPrompt(null)}
        onSelectIssue={openIssue}
      />
    </div>
  );
}
