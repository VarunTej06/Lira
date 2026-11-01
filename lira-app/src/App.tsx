import { useState, useEffect, useCallback } from 'react';
import { TopNavigation } from './components/layout/TopNavigation';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { BoardActionBar } from './components/board/BoardActionBar';
import { KanbanBoard } from './components/board/KanbanBoard';
import { IssueDetailModal } from './components/issue/IssueDetailModal';
import { CreateIssueModal } from './components/issue/CreateIssueModal';
import { CreateSpaceModal } from './components/board/CreateSpaceModal';
import { LiraInfoChatbot } from './components/ai/LiraInfoChatbot';
import { LiraAIAgentConsole } from './components/ai/LiraAIAgentConsole';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useSpaces } from './hooks/useSpaces';
import { useIssuesBySpace } from './hooks/useIssues';
import { requestDurableStorage } from './db/db';
import { initLocalDiskSync } from './services/localDiskSync';
import type { Issue } from './types/issue';

export default function App() {
  const spaces = useSpaces();
  const [activeSpaceId, setActiveSpaceId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('lira_active_space_id');
    return saved ? Number(saved) : undefined;
  });

  const handleSelectSpace = useCallback((id: number) => {
    setActiveSpaceId(id);
    localStorage.setItem('lira_active_space_id', String(id));
  }, []);

  // Issue navigation stack — supports drilling in from Epic → Story → Task
  const [issueNavStack, setIssueNavStack] = useState<Issue[]>([]);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [createIssueStatus, setCreateIssueStatus] = useState('todo');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showAIChatbot, setShowAIChatbot] = useState(false);
  const [showAIAgent, setShowAIAgent] = useState(false);
  const [pendingAgentPrompt, setPendingAgentPrompt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState(false);
  const [activeTab, setActiveTab] = useState('Board');
  const [initialized, setInitialized] = useState(false);

  const activeSpace = spaces?.find(s => s.id === activeSpaceId);
  const issues = useIssuesBySpace(activeSpaceId) || [];

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
    // Push onto navigation stack for breadcrumb drill-down
    setIssueNavStack(prev => {
      // If already in stack, pop back to it
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

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-jira-bg">
        <div className="text-center space-y-3">
          <img src="/lira-logo.png" alt="Lira Logo" className="w-16 h-16 mx-auto animate-pulse object-contain" />
          <p className="text-jira-muted text-sm font-medium">Initializing Lira…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-jira-bg font-sans">
      <TopNavigation
        onCreateIssue={() => setShowCreateIssue(true)}
        onToggleAI={() => setShowAIAgent(v => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          spaces={spaces || []}
          activeSpaceId={activeSpaceId}
          onSpaceSelect={handleSelectSpace}
          onCreateSpace={() => setShowCreateSpace(true)}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {activeSpaceId ? (
            <>
              <BoardActionBar
                space={activeSpace}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterAssignee={filterAssignee}
                onFilterAssigneeToggle={() => setFilterAssignee(f => !f)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              {activeTab === 'Board' ? (
                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  <KanbanBoard
                    issues={issues}
                    space={activeSpace}
                    searchQuery={searchQuery}
                    filterAssignee={filterAssignee}
                    onIssueClick={openIssue}
                    onAddIssue={handleAddIssue}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-jira-bg">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">🚧</div>
                    <p className="text-jira-muted text-sm font-medium">{activeTab} view — coming soon</p>
                    <button onClick={() => setActiveTab('Board')} className="text-jira-blue text-sm hover:underline">
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
                <button onClick={() => setShowCreateSpace(true)} className="px-5 py-2.5 bg-jira-blue text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  Create your first space
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Issue detail modal — wrapped in error boundary so crashes don't kill the whole app */}
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
        space={activeSpace}
        defaultStatus={createIssueStatus}
      />

      <CreateSpaceModal
        isOpen={showCreateSpace}
        onClose={() => setShowCreateSpace(false)}
        onCreated={id => handleSelectSpace(id)}
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
