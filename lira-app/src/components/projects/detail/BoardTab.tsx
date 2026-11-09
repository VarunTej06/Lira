import { Search } from 'lucide-react';
import { KanbanBoard } from '../../board/KanbanBoard';
import { SprintFilterBar } from '../../sprints/sprintParts';
import type { DetailCtx } from './detailContext';

export function BoardTab(ctx: DetailCtx) {
  const { project, space, onIssueClick, onAddIssue, stats, boardSearchQuery, setBoardSearchQuery, filterAssignee, setFilterAssignee, boardPriorityFilter, setBoardPriorityFilter, boardActiveFilters, boardSprint, setBoardSprint, boardIssues, sprintKeys, setActiveTab } = ctx;
  return (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Filter Sub-bar */}
            <div className="bg-white/80 backdrop-blur-xs border-b border-lira-border px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={boardSearchQuery}
                    onChange={e => setBoardSearchQuery(e.target.value)}
                    placeholder={`Search issues in ${project.name}...`}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue focus:bg-white transition-all"
                  />
                </div>

                {/* Assignee filter button */}
                <button
                  onClick={() => setFilterAssignee(v => !v)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                    filterAssignee
                      ? 'bg-blue-50 border-lira-blue text-lira-blue'
                      : 'bg-white border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  Only My Issues (VY)
                </button>

                {/* Priority filters */}
                <select
                  value={boardPriorityFilter}
                  onChange={e => setBoardPriorityFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-lira-border rounded-lg text-lira-text cursor-pointer focus:outline-none focus:border-lira-blue"
                >
                  <option value="">All Priorities</option>
                  <option value="highest">Highest</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Progress Summary Metrics */}
              <div className="flex items-center gap-3 text-xs text-lira-muted">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-lira-text">{stats.done}/{stats.total}</span>
                  <span>done</span>
                </div>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
                <span className="font-semibold text-emerald-600">{stats.percent}%</span>
              </div>
            </div>

            <SprintFilterBar value={boardSprint} options={sprintKeys} onChange={setBoardSprint} onManage={() => setActiveTab('sprints')} />

            {/* Kanban Board Container */}
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <KanbanBoard
                issues={boardIssues}
                space={space}
                searchQuery={boardSearchQuery}
                filterAssignee={filterAssignee}
                onIssueClick={onIssueClick || (() => {})}
                onAddIssue={onAddIssue || (() => {})}
                activeFilters={boardActiveFilters}
                groupBy="status"
              />
            </div>
          </div>
  );
}
