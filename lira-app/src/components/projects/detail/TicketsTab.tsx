import { statusLabel } from '../../../utils/status';
import { TypeIcon } from '../../common/Icons';
import { Ticket, Search } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { formatRelativeDate, formatAbsoluteDate } from '../../../utils/dateUtils';
import { SprintSelect, SprintChip } from '../../sprints/sprintParts';
import { getStatusBadgeClass, getPriorityBadge } from './badges';
import { getIssueSprint } from '../../../utils/sprintUtils';
import type { DetailCtx } from './detailContext';

export function TicketsTab(ctx: DetailCtx) {
  const { onIssueClick, ticketSubTab, setTicketSubTab, ticketSearch, setTicketSearch, ticketSprint, setTicketSprint, sprintKeys, ticketCounts, ticketsToDisplay } = ctx;
  return (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white">
            {/* Sub-tabs & Search Toolbar */}
            <div className="px-6 py-3 border-b border-lira-border bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              {/* Sub-tabs: All, Open, Completed, High Priority, My Tasks */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setTicketSubTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'all'
                      ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                      : 'bg-white border border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  <span>All</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full ${ticketSubTab === 'all' ? 'bg-lira-blue text-lira-on-blue' : 'bg-gray-100 text-gray-700'}`}>
                    {ticketCounts.all}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'open'
                      ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                      : 'bg-white border border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  <span>Open</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full ${ticketSubTab === 'open' ? 'bg-lira-blue text-lira-on-blue' : 'bg-amber-100 text-amber-800'}`}>
                    {ticketCounts.open}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'completed'
                      ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                      : 'bg-white border border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  <span>Completed</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full ${ticketSubTab === 'completed' ? 'bg-lira-blue text-lira-on-blue' : 'bg-emerald-100 text-emerald-800'}`}>
                    {ticketCounts.completed}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('high_priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'high_priority'
                      ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                      : 'bg-white border border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  <span>High Priority</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full ${ticketSubTab === 'high_priority' ? 'bg-lira-blue text-lira-on-blue' : 'bg-red-100 text-red-800'}`}>
                    {ticketCounts.high_priority}
                  </span>
                </button>

                <button
                  onClick={() => setTicketSubTab('my_tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    ticketSubTab === 'my_tasks'
                      ? 'bg-lira-blue text-lira-on-blue shadow-2xs'
                      : 'bg-white border border-lira-border text-lira-muted hover:text-lira-text'
                  }`}
                >
                  <span>My Tasks</span>
                  <span className={`text-2xs px-1.5 py-0.2 rounded-full ${ticketSubTab === 'my_tasks' ? 'bg-lira-blue text-lira-on-blue' : 'bg-purple-100 text-purple-800'}`}>
                    {ticketCounts.my_tasks}
                  </span>
                </button>
              </div>

              <SprintSelect value={ticketSprint} options={sprintKeys} onChange={setTicketSprint} allLabel="All sprints" title="Filter by sprint" className="!py-1.5 !rounded-lg" />

              {/* Search Within Tickets */}
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={ticketSearch}
                  onChange={e => setTicketSearch(e.target.value)}
                  placeholder="Filter tickets..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-lira-border rounded-lg focus:outline-none focus:border-lira-blue shadow-2xs"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-12 text-center">Type</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Key</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 min-w-[220px]">Title</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-24">Sprint</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-28">Priority</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-36">Assignee</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-700 w-32">Updated Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ticketsToDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Ticket className="w-8 h-8 text-gray-300" />
                          <p className="text-sm font-semibold text-lira-text">No tickets found</p>
                          <p className="text-xs text-lira-muted">
                            {ticketSearch ? 'Try adjusting your search query.' : 'There are no tickets matching the active sub-tab.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ticketsToDisplay.map(issue => (
                      <tr
                        key={issue.id || issue.key}
                        onClick={() => onIssueClick?.(issue)}
                        className="hover:bg-lira-blue-light/50 transition-colors cursor-pointer group"
                      >
                        {/* Type Icon */}
                        <td className="py-2.5 px-3 text-center text-sm">
                          <span title={ISSUE_TYPE_CONFIG[issue.type]?.label || issue.type}>
                            <TypeIcon type={issue.type} className="w-4 h-4" />
                          </span>
                        </td>

                        {/* Key */}
                        <td className="py-2.5 px-3 font-mono font-bold text-lira-blue group-hover:underline whitespace-nowrap">
                          {issue.key}
                        </td>

                        {/* Title */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-lira-text group-hover:text-lira-blue transition-colors line-clamp-1">
                            {issue.title}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {issue.type === 'epic'
                            ? <span className="text-lira-muted">—</span>
                            : <SprintChip sprint={getIssueSprint(issue)} carried={(issue.sprintHistory || []).length > 0} />}
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-2xs font-semibold border capitalize ${getStatusBadgeClass(issue.status)}`}>
                            {statusLabel(issue.status)}
                          </span>
                        </td>

                        {/* Priority Dot */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getPriorityBadge(issue.priority)}
                        </td>

                        {/* Assignee Avatar */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar
                              initials={issue.assigneeInitials || (issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : 'UN')}
                              size="xs"
                            />
                            <span className="truncate max-w-[110px] text-lira-text">
                              {issue.assignee || 'Unassigned'}
                            </span>
                          </div>
                        </td>

                        {/* Updated Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-lira-muted text-xs">
                          {formatRelativeDate(issue.updatedAt || issue.createdAt) || formatAbsoluteDate(issue.updatedAt || issue.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
  );
}
