import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { formatRelativeDate, formatDayDateTime } from '../../utils/dateUtils';
import type { Comment, ActivityEntry, Attachment } from '../../types/issue';
import { Send, Pencil } from 'lucide-react';
import { RichTextEditor } from '../common/richtext/RichTextEditor';
import { CopyButton } from '../common/CopyButton';
import { descriptionToText } from '../../utils/richText';
import { isOwnComment, hasCommentContent, newComment, NO_COMMENT_DRAFT, type CommentDraft } from './commentUtils';
import { currentUser } from '../../utils/currentUser';

interface IssueActivityFeedProps {
  comments: Comment[];
  activity: ActivityEntry[];
  onAddComment: (comment: Comment) => void;
  /** Changes a comment. Only the person who wrote it can do this. */
  onEditComment?: (id: string, content: string, attachments: Attachment[]) => void;
  /** The comment being written. It is kept by the ticket popup so that Save changes can ask about it. */
  draft: CommentDraft;
  onDraftChange: (draft: CommentDraft) => void;
}

type ViewTab = 'all' | 'comments' | 'history';

export const IssueActivityFeed: React.FC<IssueActivityFeedProps> = ({ comments, activity, onAddComment, onEditComment, draft: commentDraft, onDraftChange }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const { html: draft, files: draftFiles } = commentDraft;
  const setDraft = (html: string) => onDraftChange({ html, files: draftFiles });
  const setDraftFiles = (files: Attachment[]) => onDraftChange({ html: draft, files });
  const [focused, setFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editFiles, setEditFiles] = useState<Attachment[]>([]);

  const QUICK_CHIPS = ['Status update...', 'Thanks!', 'Agree!', 'Will fix ASAP'];

  const reset = () => { onDraftChange(NO_COMMENT_DRAFT); setFocused(false); };

  const handleSubmit = () => {
    if (!hasCommentContent(draft, draftFiles)) return;
    onAddComment(newComment(commentDraft));
    reset();
  };

  const startEdit = (c: Comment) => { setEditingId(c.id); setEditText(c.content); setEditFiles(c.attachments ?? []); };
  const saveEdit = () => {
    if (!editingId || !hasCommentContent(editText, editFiles)) return;
    onEditComment?.(editingId, editText, editFiles);
    setEditingId(null);
  };

  // Build combined feed
  const allEntries = [
    ...comments.map(c => ({ type: 'comment' as const, data: c, date: c.createdAt })),
    ...activity.map(a => ({ type: 'activity' as const, data: a, date: a.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = activeTab === 'all' ? allEntries
    : activeTab === 'comments' ? allEntries.filter(e => e.type === 'comment')
    : allEntries.filter(e => e.type === 'activity');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-lira-text mr-2">Activity</span>
        {(['all', 'comments', 'history'] as ViewTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-lira-blue-light text-lira-blue'
                : 'text-lira-muted hover:text-lira-text hover:bg-gray-100'
            }`}
          >
            {tab === 'history' ? 'History' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Comment box */}
      <div className="flex gap-3">
        <Avatar initials={currentUser().initials} size="sm" className="flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          {!focused ? (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => { setDraft(chip === 'Status update...' ? '' : `<p>${chip} </p>`); setFocused(true); }}
                    className="px-3 py-1.5 text-xs border border-lira-border rounded-full hover:bg-gray-50 hover:border-lira-blue text-lira-muted hover:text-lira-blue transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFocused(true)}
                data-testid="comment-placeholder"
                className="w-full text-left text-sm px-3 py-2.5 border border-lira-border rounded-lg text-lira-muted hover:border-lira-blue transition-colors cursor-text"
              >
                Add a comment... (you can paste screenshots and add files)
              </button>
            </>
          ) : (
            <div data-testid="comment-composer">
              <RichTextEditor
                variant="compact"
                autoFocus
                value={draft}
                onChange={setDraft}
                attachments={draftFiles}
                onAttachmentsChange={setDraftFiles}
                placeholder="Add a comment..."
                minHeight={72}
                ariaLabel="Add a comment"
                onSubmit={handleSubmit}
              />
              <div className="flex items-center justify-end pt-2">
                <div className="flex gap-2">
                  <button onClick={reset} className="px-3 py-1 text-xs text-lira-muted hover:text-lira-text rounded cursor-pointer">Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={!hasCommentContent(draft, draftFiles)}
                    data-testid="post-comment"
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-lira-blue text-lira-on-blue rounded hover:bg-lira-blue-hover disabled:opacity-50 font-medium cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {filtered.map((entry, idx) => (
          <div key={idx} className="flex gap-3">
            <Avatar initials={entry.data.authorInitials || (entry.data as ActivityEntry).author?.slice(0, 2) || 'VY'} size="sm" className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {entry.type === 'comment' ? (
                <CommentView
                  comment={entry.data as Comment}
                  date={entry.date}
                  editing={editingId === (entry.data as Comment).id}
                  canEdit={!!onEditComment && isOwnComment(entry.data as Comment)}
                  onStartEdit={() => startEdit(entry.data as Comment)}
                  editText={editText}
                  setEditText={setEditText}
                  editFiles={editFiles}
                  setEditFiles={setEditFiles}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={saveEdit}
                />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-lira-muted">
                  <span className="font-medium text-lira-text">{(entry.data as ActivityEntry).author || 'User'}</span>
                  <span>{(entry.data as ActivityEntry).description || ((entry.data as ActivityEntry).type === 'created' ? 'created this issue' : (entry.data as ActivityEntry).type)}</span>
                  {(entry.data as ActivityEntry).oldValue && (
                    <>
                      <span className="line-through text-lira-muted">{(entry.data as ActivityEntry).oldValue}</span>
                      <span>→</span>
                      <span className="font-medium text-lira-text">{(entry.data as ActivityEntry).newValue}</span>
                    </>
                  )}
                  <time className="ml-auto flex-shrink-0" title={formatRelativeDate(entry.date)}>{formatDayDateTime(entry.date)}</time>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface CommentViewProps {
  comment: Comment;
  date: Date | string;
  editing: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  editText: string;
  setEditText: (v: string) => void;
  editFiles: Attachment[];
  setEditFiles: (a: Attachment[]) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}

const CommentView: React.FC<CommentViewProps> = ({ comment: c, date, editing, canEdit, onStartEdit, editText, setEditText, editFiles, setEditFiles, onCancelEdit, onSaveEdit }) => (
  <div>
    <div className="flex items-baseline gap-2 mb-1">
      <span className="text-sm font-semibold text-lira-text">{c.author || 'User'}</span>
      <time className="text-xs text-lira-muted" data-testid="comment-time" dateTime={new Date(date).toISOString()} title={formatRelativeDate(date)}>{formatDayDateTime(date)}</time>
      {c.updatedAt && <span className="text-xs text-lira-muted italic" title={formatDayDateTime(c.updatedAt)}>(edited)</span>}
      <span className="ml-auto flex items-center gap-3">
        <CopyButton label="Copy" getText={() => descriptionToText(c.content)} getHtml={() => c.content} />
        {canEdit && !editing && (
          <button type="button" onClick={onStartEdit} className="flex items-center gap-1 text-xs text-lira-muted hover:text-lira-blue cursor-pointer" data-testid="edit-comment">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </span>
    </div>
    {editing ? (
      <div data-testid="comment-editor">
        <RichTextEditor
          key="edit"
          variant="compact"
          autoFocus
          value={editText}
          onChange={setEditText}
          attachments={editFiles}
          onAttachmentsChange={setEditFiles}
          minHeight={72}
          ariaLabel="Edit comment"
          onSubmit={onSaveEdit}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancelEdit} className="px-3 py-1 text-xs text-lira-muted hover:text-lira-text rounded cursor-pointer">Cancel</button>
          <button
            onClick={onSaveEdit}
            disabled={!hasCommentContent(editText, editFiles)}
            data-testid="save-comment-edit"
            className="px-3 py-1 text-xs bg-lira-blue text-lira-on-blue rounded hover:bg-lira-blue-hover disabled:opacity-50 font-medium cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    ) : (
      <div className="bg-gray-50 rounded-lg px-3 py-2 border border-lira-border" data-testid="comment-body">
        <RichTextEditor key="view" readOnly variant="compact" value={c.content} onChange={() => {}} attachments={c.attachments ?? []} ariaLabel="Comment" />
      </div>
    )}
  </div>
);
