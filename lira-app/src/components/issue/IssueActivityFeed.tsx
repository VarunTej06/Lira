import React, { useState } from 'react';
import { Avatar } from '../common/Avatar';
import { formatRelativeDate } from '../../utils/dateUtils';
import type { Comment, ActivityEntry } from '../../types/issue';
import { v4 as uuidv4 } from 'uuid';
import { Send, Pencil } from 'lucide-react';

interface IssueActivityFeedProps {
  comments: Comment[];
  activity: ActivityEntry[];
  onAddComment: (comment: Comment) => void;
  /** Changes the text of a comment. Only the person who wrote it can do this. */
  onEditComment?: (id: string, content: string) => void;
}

/** The person using Lira, as set in their profile. */
function currentUser() {
  try {
    return {
      name: localStorage.getItem('lira_user_name') || 'Varuntej Yadla',
      initials: localStorage.getItem('lira_user_initials') || 'VY',
    };
  } catch { return { name: 'Varuntej Yadla', initials: 'VY' }; }
}

/** A comment can be edited by the person who wrote it. */
export function isOwnComment(c: Comment): boolean {
  const me = currentUser();
  return [c.author, c.authorInitials].some(v => !!v && (v === me.initials || v === me.name));
}

type ViewTab = 'all' | 'comments' | 'history';

export const IssueActivityFeed: React.FC<IssueActivityFeedProps> = ({
  comments,
  activity,
  onAddComment,
  onEditComment,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [commentText, setCommentText] = useState('');
  const [focused, setFocused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const saveEdit = () => {
    const text = editText.trim();
    if (!editingId || !text) return;
    onEditComment?.(editingId, text);
    setEditingId(null);
  };

  const QUICK_CHIPS = ['Status update...', 'Thanks!', 'Agree!', 'Will fix ASAP'];

  const handleSubmit = () => {
    if (!commentText.trim()) return;
    onAddComment({
      id: uuidv4(),
      author: currentUser().initials,
      authorInitials: currentUser().initials,
      content: commentText.trim(),
      createdAt: new Date(),
    });
    setCommentText('');
    setFocused(false);
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
        <Avatar initials="VY" size="sm" color="#0052CC" className="flex-shrink-0 mt-1" />
        <div className="flex-1">
          {/* Quick chips */}
          {!focused && commentText === '' && (
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => { setCommentText(chip === 'Status update...' ? '' : chip + ' '); setFocused(true); }}
                  className="px-3 py-1.5 text-xs border border-lira-border rounded-full hover:bg-gray-50 hover:border-lira-blue text-lira-muted hover:text-lira-blue transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className={`border rounded-lg transition-all ${focused ? 'border-lira-blue ring-1 ring-lira-blue' : 'border-lira-border'}`}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => { if (!commentText) setFocused(false); }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
              placeholder="Add a comment..."
              rows={focused ? 3 : 1}
              className="w-full text-sm p-3 resize-none focus:outline-none rounded-lg text-lira-text placeholder-lira-muted"
            />
            {focused && (
              <div className="flex items-center justify-between px-3 pb-2 border-t border-gray-100">
                <span className="text-[10px] text-lira-muted">
                  Pro tip: press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Enter</kbd> to save
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCommentText(''); setFocused(false); }}
                    className="px-3 py-1 text-xs text-lira-muted hover:text-lira-text rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!commentText.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs bg-lira-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    <Send className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {filtered.map((entry, idx) => (
          <div key={idx} className="flex gap-3">
            <Avatar initials={entry.data.authorInitials || (entry.data as ActivityEntry).author?.slice(0, 2) || 'VY'} size="sm" className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {entry.type === 'comment' ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-lira-text">{(entry.data as Comment).author || 'User'}</span>
                    <span className="text-xs text-lira-muted">{formatRelativeDate(entry.date)}</span>
                    {(entry.data as Comment).updatedAt && <span className="text-xs text-lira-muted italic">(edited)</span>}
                    {onEditComment && isOwnComment(entry.data as Comment) && editingId !== (entry.data as Comment).id && (
                      <button
                        type="button"
                        onClick={() => { setEditingId((entry.data as Comment).id); setEditText((entry.data as Comment).content); }}
                        className="ml-auto flex items-center gap-1 text-xs text-lira-muted hover:text-lira-blue cursor-pointer"
                        data-testid="edit-comment"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                  {editingId === (entry.data as Comment).id ? (
                    <div className="border border-lira-blue ring-1 ring-lira-blue rounded-lg">
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
                        }}
                        rows={3}
                        aria-label="Edit comment"
                        className="w-full text-sm p-3 resize-none focus:outline-none rounded-lg text-lira-text"
                      />
                      <div className="flex justify-end gap-2 px-3 pb-2 border-t border-gray-100 pt-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-lira-muted hover:text-lira-text rounded cursor-pointer">Cancel</button>
                        <button
                          onClick={saveEdit}
                          disabled={!editText.trim()}
                          data-testid="save-comment-edit"
                          className="px-3 py-1 text-xs bg-lira-blue text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-lira-text whitespace-pre-wrap border border-lira-border">
                      {(entry.data as Comment).content}
                    </div>
                  )}
                </div>
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
                  <span className="ml-auto flex-shrink-0">{formatRelativeDate(entry.date)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
