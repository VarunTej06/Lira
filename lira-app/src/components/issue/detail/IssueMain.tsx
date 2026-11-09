import { keepPlace } from '../../../utils/keepPlace';
import { CopyButton } from '../../common/CopyButton';
import { descriptionToText, isHtmlDescription } from '../../../utils/richText';
import { RichTextEditor } from '../../common/richtext/RichTextEditor';
import { promptDialog } from '../../common/dialogs';
import { TypeIcon } from '../../common/Icons';
import { Plus, ChevronDown, Link } from 'lucide-react';
import type { IssueType } from '../../../types/issue';
import { IssueSubtasks } from '../IssueSubtasks';
import { IssueAttachments } from '../IssueAttachments';
import { IssueActivityFeed } from '../IssueActivityFeed';
import { ChildIssues } from '../ChildIssues';
import { safeArr } from './issueOptions';
import type { IssueDetailState } from './useIssueDetail';

/** Title, description, attachments, child work items, subtasks and activity. */
export function IssueMain(s: IssueDetailState) {
  const {  onNavigateToIssue,  local, editingTitle, setEditingTitle, titleVal, setTitleVal, descVal, setDescVal, descCollapsed, setDescCollapsed, attCollapsed, setAttCollapsed, childCollapsed, setChildCollapsed, childIssues, resolvedParent, patch, handleTitleSave, handleAddComment, handleEditComment, handleCreateChildIssue, childCount, doneChildCount, childProgress } = s;
  const commentFiles = safeArr(local.comments).flatMap(c => safeArr(c.attachments).map(attachment => ({ attachment, author: c.author || 'User', at: c.createdAt })));
  return (
    <>
          {/* ── LEFT: Main content ── */}
          <div className="md:flex-1 md:overflow-y-auto min-w-0 px-4 md:px-6 pt-4 pb-10 space-y-5">

            {/* Quick action bar */}
            <div className="flex items-center gap-2">
              {local.type !== 'subtask' && (
                <button
                  onClick={async () => {
                    const type = local.type === 'epic' ? 'task' : 'subtask';
                    const title = await promptDialog({ title: `New ${type}`, label: 'Title', placeholder: 'What needs to be done?', confirmLabel: 'Create' });
                    if (title) handleCreateChildIssue(title, type as IssueType);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lira-muted border border-lira-border rounded-md hover:bg-gray-50 hover:text-lira-blue transition-all"
                  title="Add child issue"
                >
                  <Plus className="w-3.5 h-3.5" /> Child issue
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-lira-muted border border-lira-border rounded-md hover:bg-gray-50 transition-all">
                <Link className="w-3.5 h-3.5" /> Link issue
              </button>
            </div>

            {/* Linked Parent pill badge (Subtask -> Task, Story -> Epic, Task -> Story) */}
            {resolvedParent && (
              <div className="mb-1.5">
                <button
                  type="button"
                  onClick={() => onNavigateToIssue?.(resolvedParent)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-md text-lira-text font-normal transition-colors group/parent shadow-2xs"
                  title={`Parent: ${resolvedParent.key} — ${resolvedParent.title}. Click to open parent.`}
                >
                  <TypeIcon type={resolvedParent.type} />
                  <span className="font-semibold text-lira-text font-mono text-[11px]">{resolvedParent.key}</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-lira-text max-w-sm truncate">{resolvedParent.title}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover/parent:text-lira-blue transition-colors ml-0.5" />
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
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { e.stopPropagation(); setEditingTitle(false); setTitleVal(s.issue?.title ?? local.title); } }}
                className="w-full text-2xl font-bold text-lira-text border-b-2 border-lira-blue outline-none pb-1 bg-transparent leading-tight"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-lira-text cursor-text hover:bg-blue-50/50 rounded px-1 -mx-1 py-0.5 transition-colors leading-tight"
                onClick={() => setEditingTitle(true)}
              >
                {local.title}
              </h1>
            )}

            {/* ── Description ── */}
            <section>
              <div className="flex items-center mb-2">
                <button
                  onClick={e => keepPlace(e.currentTarget, () => setDescCollapsed(c => !c))}
                  className="flex items-center gap-1.5 flex-1 text-left text-sm font-semibold text-lira-text hover:text-lira-blue transition-colors group"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${descCollapsed ? '-rotate-90' : ''}`} />
                  Description
                </button>
                <CopyButton label="Copy description" getText={() => descriptionToText(descVal)} getHtml={() => (descVal && isHtmlDescription(descVal) ? descVal : undefined)} />
              </div>
              {!descCollapsed && (
                <div>
                  <RichTextEditor
                    value={descVal}
                    onChange={setDescVal}
                    attachments={safeArr(local.attachments)}
                    onAttachmentsChange={a => patch({ attachments: a })}
                    placeholder="Add a description..."
                    minHeight={160}
                  />
                </div>
              )}
            </section>

            {/* ── Attachments ── */}
            <section>
              <button
                onClick={e => keepPlace(e.currentTarget, () => setAttCollapsed(c => !c))}
                className="flex items-center gap-1.5 w-full text-sm font-semibold text-lira-text mb-2 hover:text-lira-blue transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${attCollapsed ? '-rotate-90' : ''}`} />
                Attachments
                {safeArr(local.attachments).length + commentFiles.length > 0 && (
                  <span className="ml-1 text-xs text-lira-muted font-normal">({safeArr(local.attachments).length + commentFiles.length})</span>
                )}
              </button>
              {!attCollapsed && (
                <IssueAttachments
                  attachments={safeArr(local.attachments)}
                  onUpdate={a => patch({ attachments: a })}
                  fromComments={commentFiles}
                />
              )}
            </section>

            {/* ── Child work items (Epic→Tasks, Task→Subtasks) ── */}
            {(local.type === 'epic' || local.type === 'task') && (
              <section>
                <button
                  onClick={e => keepPlace(e.currentTarget, () => setChildCollapsed(c => !c))}
                  className="flex items-center gap-1.5 w-full text-sm font-semibold text-lira-text mb-2 hover:text-lira-blue transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${childCollapsed ? '-rotate-90' : ''}`} />
                  Child work items
                  {childCount > 0 && (
                    <span className="ml-1 text-xs text-lira-muted font-normal">
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
                          <div className="bg-lira-green transition-all" style={{ width: `${childProgress}%` }} />
                          <div className="bg-lira-blue transition-all" style={{ width: `${Math.max(0, 100 - childProgress)}%`, opacity: 0.2 }} />
                        </div>
                        <p className="text-[10px] text-lira-muted mt-1">{childProgress}% Done</p>
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
            <div className="border-t border-lira-border pt-5">
              <IssueActivityFeed
                comments={safeArr(local.comments)}
                activity={safeArr(local.activity)}
                onAddComment={handleAddComment}
                onEditComment={handleEditComment}
              />
            </div>
          </div>
    </>
  );
}
