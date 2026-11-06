import { Plus, ChevronDown, Paperclip, Link } from 'lucide-react';
import type { IssueType } from '../../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { IssueSubtasks } from '../IssueSubtasks';
import { IssueAttachments } from '../IssueAttachments';
import { IssueActivityFeed } from '../IssueActivityFeed';
import { ChildIssues } from '../ChildIssues';
import { safeArr } from './useIssueDetail';
import type { IssueDetailState } from './useIssueDetail';

/** Title, description, attachments, child work items, subtasks and activity. */
export function IssueMain(s: IssueDetailState) {
  const {  onNavigateToIssue,  local, editingTitle, setEditingTitle, titleVal, setTitleVal, descVal, setDescVal, descCollapsed, setDescCollapsed, attCollapsed, setAttCollapsed, childCollapsed, setChildCollapsed, childIssues, resolvedParent, patch, handleTitleSave, handleAddComment, handleCreateChildIssue, childCount, doneChildCount, childProgress } = s;
  return (
    <>
          {/* ── LEFT: Main content ── */}
          <div className="md:flex-1 md:overflow-y-auto min-w-0 px-4 md:px-6 pt-4 pb-10 space-y-5">

            {/* Quick action bar */}
            <div className="flex items-center gap-2">
              {local.type !== 'subtask' && (
                <button
                  onClick={() => {
                    const type = local.type === 'epic' ? 'task' : 'subtask';
                    const title = prompt(`New ${type} title:`);
                    if (title) handleCreateChildIssue(title, type as IssueType);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded-md hover:bg-gray-50 hover:text-jira-blue transition-all"
                  title="Add child issue"
                >
                  <Plus className="w-3.5 h-3.5" /> Child issue
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded-md hover:bg-gray-50 transition-all">
                <Link className="w-3.5 h-3.5" /> Link issue
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-jira-muted border border-jira-border rounded-md hover:bg-gray-50 transition-all">
                <Paperclip className="w-3.5 h-3.5" /> Attach
              </button>
            </div>

            {/* Linked Parent pill badge (Subtask -> Task, Story -> Epic, Task -> Story) */}
            {resolvedParent && (
              <div className="mb-1.5">
                <button
                  type="button"
                  onClick={() => onNavigateToIssue?.(resolvedParent)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-md text-jira-text font-normal transition-colors group/parent shadow-2xs"
                  title={`Parent: ${resolvedParent.key} — ${resolvedParent.title}. Click to open parent.`}
                >
                  <span style={{ color: ISSUE_TYPE_CONFIG[resolvedParent.type]?.color }}>
                    {ISSUE_TYPE_CONFIG[resolvedParent.type]?.symbol}
                  </span>
                  <span className="font-semibold text-jira-text font-mono text-[11px]">{resolvedParent.key}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-jira-text max-w-sm truncate">{resolvedParent.title}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover/parent:text-jira-blue transition-colors ml-0.5" />
                </button>
              </div>
            )}

            {/* Title */}
            {editingTitle ? (
              <input
                autoFocus
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setEditingTitle(false); setTitleVal(local.title); } }}
                className="w-full text-2xl font-bold text-jira-text border-b-2 border-jira-blue outline-none pb-1 bg-transparent leading-tight"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-jira-text cursor-text hover:bg-blue-50/50 rounded px-1 -mx-1 py-0.5 transition-colors leading-tight"
                onClick={() => setEditingTitle(true)}
              >
                {local.title}
              </h1>
            )}

            {/* ── Description ── */}
            <section>
              <button
                onClick={() => setDescCollapsed(c => !c)}
                className="flex items-center gap-1.5 w-full text-sm font-semibold text-jira-text mb-2 hover:text-jira-blue transition-colors group"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${descCollapsed ? '-rotate-90' : ''}`} />
                Description
              </button>
              {!descCollapsed && (
                <div>
                  <textarea
                    value={descVal}
                    onChange={e => setDescVal(e.target.value)}
                    placeholder="Add a description..."
                    rows={6}
                    className="w-full text-sm text-jira-text border border-jira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue resize-none transition-all leading-relaxed"
                  />
                  {descVal !== local.description && (
                    <p className="text-[10px] text-jira-muted mt-1 animate-pulse">Auto-saving…</p>
                  )}
                </div>
              )}
            </section>

            {/* ── Attachments ── */}
            <section>
              <button
                onClick={() => setAttCollapsed(c => !c)}
                className="flex items-center gap-1.5 w-full text-sm font-semibold text-jira-text mb-2 hover:text-jira-blue transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${attCollapsed ? '-rotate-90' : ''}`} />
                Attachments
                {safeArr(local.attachments).length > 0 && (
                  <span className="ml-1 text-xs text-jira-muted font-normal">({local.attachments!.length})</span>
                )}
              </button>
              {!attCollapsed && (
                <IssueAttachments
                  attachments={safeArr(local.attachments)}
                  onUpdate={a => patch({ attachments: a })}
                />
              )}
            </section>

            {/* ── Child work items (Epic→Tasks, Task→Subtasks) ── */}
            {(local.type === 'epic' || local.type === 'task') && (
              <section>
                <button
                  onClick={() => setChildCollapsed(c => !c)}
                  className="flex items-center gap-1.5 w-full text-sm font-semibold text-jira-text mb-2 hover:text-jira-blue transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${childCollapsed ? '-rotate-90' : ''}`} />
                  Child work items
                  {childCount > 0 && (
                    <span className="ml-1 text-xs text-jira-muted font-normal">
                      ({doneChildCount}/{childCount} done)
                    </span>
                  )}
                </button>

                {!childCollapsed && (
                  <>
                    {/* Progress bar */}
                    {childCount > 0 && (
                      <div className="mb-3">
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                          <div className="bg-jira-green transition-all" style={{ width: `${childProgress}%` }} />
                          <div className="bg-jira-blue transition-all" style={{ width: `${Math.max(0, 100 - childProgress)}%`, opacity: 0.2 }} />
                        </div>
                        <p className="text-[10px] text-jira-muted mt-1">{childProgress}% Done</p>
                      </div>
                    )}
                    <ChildIssues
                      parentIssue={local}
                      childIssues={childIssues}
                      onIssueClick={issue => onNavigateToIssue?.(issue)}
                      onCreateChild={handleCreateChildIssue}
                    />
                  </>
                )}
              </section>
            )}

            {/* ── Subtasks (for Tasks only — checklist style) ── */}
            {local.type === 'task' && (
              <IssueSubtasks
                subtasks={safeArr(local.subtasks)}
                onUpdate={s => patch({ subtasks: s })}
              />
            )}

            {/* ── Activity ── */}
            <div className="border-t border-jira-border pt-5">
              <IssueActivityFeed
                comments={safeArr(local.comments)}
                activity={safeArr(local.activity)}
                onAddComment={handleAddComment}
              />
            </div>
          </div>
    </>
  );
}
