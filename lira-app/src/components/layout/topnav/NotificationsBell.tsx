import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, ExternalLink } from 'lucide-react';
import { Avatar } from '../../common/Avatar';
import type { Issue } from '../../../types/issue';
import { useClickOutside, relativeTime } from './shared';

export const NotificationsBell: React.FC<{
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, onSelectIssue }) => {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'edited' | 'closed'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Collect and classify action entries (created / edited / closed) across issues
  const notifications = useMemo(() => {
    type ActionCategory = 'created' | 'edited' | 'closed';
    type Entry = {
      id: string;
      issue: Issue;
      author: string;
      category: ActionCategory;
      actionText: string;
      createdAt: Date | string;
    };
    const all: Entry[] = [];

    issues.forEach(issue => {
      // 1. Closed tickets (Done)
      if (issue.status === 'done') {
        all.push({
          id: `${issue.key}-closed`,
          issue,
          author: issue.assigneeInitials || issue.assignee || 'VY',
          category: 'closed',
          actionText: 'closed ticket and transitioned to Done',
          createdAt: issue.resolvedAt || issue.updatedAt || issue.createdAt,
        });
      }

      // 2. Activity events (status change, created, edit)
      (issue.activity ?? []).forEach((act: unknown, idx: number) => {
        const item = act as {
          text?: string;
          description?: string;
          author?: string;
          type?: string;
          createdAt?: Date | string;
          timestamp?: Date | string;
        };

        let cat: ActionCategory = 'edited';
        let desc = item.text || item.description || 'updated ticket details';

        if (item.type === 'created') {
          cat = 'created';
          desc = `created this ${issue.type}`;
        } else if (item.type === 'status_change') {
          if (desc.toLowerCase().includes('done')) {
            cat = 'closed';
            desc = 'transitioned ticket to Done';
          } else {
            cat = 'edited';
            desc = `changed status to ${item.description || 'in progress'}`;
          }
        }

        all.push({
          id: `${issue.key}-act-${idx}`,
          issue,
          author: item.author || issue.assigneeInitials || 'VY',
          category: cat,
          actionText: desc,
          createdAt: item.createdAt || item.timestamp || issue.updatedAt || issue.createdAt,
        });
      });

      // 3. Issue creation event fallback
      if (!issue.activity || issue.activity.length === 0) {
        all.push({
          id: `${issue.key}-created`,
          issue,
          author: issue.reporter || 'VY',
          category: 'created',
          actionText: `created ${issue.type}`,
          createdAt: issue.createdAt,
        });

        // 4. Issue edit fallback if updated significantly after creation and not done
        if (
          issue.updatedAt &&
          new Date(issue.updatedAt).getTime() > new Date(issue.createdAt).getTime() + 60000 &&
          issue.status !== 'done'
        ) {
          all.push({
            id: `${issue.key}-edited`,
            issue,
            author: issue.assigneeInitials || 'VY',
            category: 'edited',
            actionText: `edited priority to ${issue.priority} & updated fields`,
            createdAt: issue.updatedAt,
          });
        }
      }
    });

    return all
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [issues]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab !== 'all' && n.category !== activeTab) return false;
      if (onlyUnread && !hasUnread) return false;
      return true;
    });
  }, [notifications, activeTab, onlyUnread, hasUnread]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer ${
          open ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'
        }`}
        title="Notifications Center"
      >
        <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        {hasUnread && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1D2125]" />}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-[#1D2939] border border-white/10 rounded-xl shadow-2xl z-50 transition-all duration-150 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.2 rounded font-mono">
                {filteredNotifications.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={e => setOnlyUnread(e.target.checked)}
                  className="w-3.5 h-3.5 text-blue-500 rounded border-white/20 bg-white/10"
                />
                <span>Only unread</span>
              </label>
              {hasUnread && (
                <button
                  onClick={() => setHasUnread(false)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Action Filter Tabs (All / Created / Edited / Closed) */}
          <div className="flex border-b border-white/10 px-2 pt-1.5 gap-1 bg-white/[0.02]">
            {[
              { id: 'all' as const, label: 'All' },
              { id: 'created' as const, label: 'Created' },
              { id: 'edited' as const, label: 'Edited' },
              { id: 'closed' as const, label: 'Closed' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-t-lg transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#1D2939] text-white border-t border-x border-white/10'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Feed */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Bell className="w-6 h-6 text-white/20" />
                <p className="text-xs text-white/50">No notifications in this view</p>
                <p className="text-[11px] text-white/30">Action updates will appear as tickets are created, edited, or closed.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const badgeColor =
                  notif.category === 'closed'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : notif.category === 'edited'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30';

                const badgeLabel =
                  notif.category === 'closed'
                    ? '✓ Closed'
                    : notif.category === 'edited'
                    ? '✏️ Edited'
                    : '+ Created';

                return (
                  <div
                    key={notif.id}
                    onClick={() => { onSelectIssue?.(notif.issue); setOpen(false); }}
                    className="flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <Avatar initials={notif.author.slice(0, 2).toUpperCase()} size="xs" className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white text-xs">{notif.author}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-white/70 text-xs">{notif.actionText}</span>
                      </div>

                      {/* Explicit Ticket Hyperlink */}
                      <div className="mt-1 flex items-center gap-1.5">
                        <a
                          href={`#issue-${notif.issue.key}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onSelectIssue?.(notif.issue);
                            setOpen(false);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-mono font-bold text-xs hover:underline flex items-center gap-0.5"
                          title={`Open ${notif.issue.key}`}
                        >
                          {notif.issue.key}
                          <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />
                        </a>
                        <span className="text-white/30 text-[11px]">·</span>
                        <span className="text-[11px] text-white/60 truncate max-w-[200px] group-hover:text-white/90">
                          {notif.issue.title}
                        </span>
                      </div>

                      <p className="text-[10px] text-white/30 mt-1">{relativeTime(notif.createdAt)}</p>
                    </div>
                    {hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
