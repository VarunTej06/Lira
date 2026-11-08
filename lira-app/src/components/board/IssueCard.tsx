import { TypeIcon, PriorityIcon } from '../common/Icons';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MoreHorizontal, Trash2, Edit3, ChevronDown, Link as LinkIcon, Link2 } from 'lucide-react';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { formatDueDate, isDueSoon, isOverdue } from '../../utils/dateUtils';
import { getPriorityConfig } from '../../utils/priorityUtils';
import { Avatar } from '../common/Avatar';
import { deleteIssue, updateIssue } from '../../hooks/useIssues';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

interface IssueCardProps {
  issue: Issue;
  index: number;
  space?: Space;
  allIssues?: Issue[];
  onClick: (issue: Issue) => void;
}

const STATUS_ACCENT: Record<string, string> = {
  inprogress: '#FFAB00',
  done: '#36B37E',
};

export const IssueCard: React.FC<IssueCardProps> = ({ issue, index, space: _space, allIssues, onClick }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const parentMenuRef = useRef<HTMLDivElement>(null);
  const parentButtonRef = useRef<HTMLButtonElement>(null);
  const [parentMenuCoords, setParentMenuCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const linkMenuRef = useRef<HTMLDivElement>(null);
  const priority = getPriorityConfig(issue.priority);
  const accentColor = STATUS_ACCENT[issue.status];
  const subtasks = Array.isArray(issue.subtasks) ? issue.subtasks : [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const totalSubtasks = subtasks.length;
  const labels = Array.isArray(issue.labels) ? issue.labels : [];

  // Resolve parent issue from space issues list
  const parentIssue = (allIssues || []).find(
    i => (issue.parentId && i.id === issue.parentId) ||
         (issue.epicId && i.id === issue.epicId) ||
         (issue.epicLink && (i.title === issue.epicLink || i.key === issue.epicLink))
  );

  // Eligible parent issues to link/change to
  const eligibleParents = (allIssues || []).filter(i => {
    if (i.id === issue.id) return false;
    if (issue.type === 'subtask') return i.type === 'task' || i.type === 'bug';
    if (issue.type === 'task') return i.type === 'epic';
    if (issue.type === 'bug') return i.type === 'epic' || i.type === 'task';
    return false;
  });

  // Close menus on outside click
  useEffect(() => {
    if (!menuOpen && !parentMenuOpen && !linkMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (parentMenuRef.current && !parentMenuRef.current.contains(target)) setParentMenuOpen(false);
      if (linkMenuRef.current && !linkMenuRef.current.contains(target)) setLinkMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, parentMenuOpen, linkMenuOpen]);

  const dueDateColor = () => {
    if (!issue.dueDate) return 'text-lira-muted';
    if (issue.status === 'done') return 'text-lira-muted';
    if (isOverdue(issue.dueDate)) return 'text-red-500';
    if (isDueSoon(issue.dueDate)) return 'text-amber-500';
    return 'text-lira-muted';
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (issue.id) await deleteIssue(issue.id);
    setShowDeleteConfirm(false);
  };

  const handleStatusChange = async (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (issue.id) await updateIssue(issue.id, { status });
  };

  return (
    <Draggable draggableId={String(issue.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-card border border-lira-border cursor-pointer group hover:shadow-card-hover overflow-hidden ${snapshot.isDragging ? 'shadow-modal rotate-1 opacity-90 scale-[1.02]' : ''}`}
        >
          {/* Status accent bar */}
          {accentColor && <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />}

          <div className="p-3" onClick={() => onClick(issue)}>
            {/* Title */}
            <p className="text-sm font-medium text-lira-text leading-snug mb-2 line-clamp-3 group-hover:text-lira-blue transition-colors">
              {issue.title}
            </p>

            {/* Parent dropdown pill (Subtask -> Task, Story -> Epic, Task -> Story) */}
            {parentIssue && (
              <div className="relative mb-2.5" onClick={e => e.stopPropagation()}>
                <button
                  ref={parentButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (parentMenuOpen) {
                      setParentMenuOpen(false);
                    } else if (parentButtonRef.current) {
                      const rect = parentButtonRef.current.getBoundingClientRect();
                      const dropdownHeight = 240;
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const top = spaceBelow < dropdownHeight && rect.top > dropdownHeight
                        ? Math.max(8, rect.top - dropdownHeight - 4)
                        : rect.bottom + 4;

                      setParentMenuCoords({
                        top,
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 290)),
                        width: Math.max(rect.width, 260),
                      });
                      setParentMenuOpen(true);
                    }
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-xs border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 rounded-md text-lira-text font-normal transition-colors text-left group/parent shadow-2xs"
                  title={`Parent: ${parentIssue.key} — ${parentIssue.title}`}
                >
                  <span className="truncate text-xs text-lira-text font-normal pr-1">
                    {parentIssue.title}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 group-hover/parent:text-lira-blue transition-transform duration-150 ${parentMenuOpen ? 'rotate-180 text-lira-blue' : ''}`} />
                </button>

                {/* Render via Portal so it pops out of the small card box without being clipped by overflow-hidden */}
                {parentMenuOpen && parentMenuCoords && createPortal(
                  <div
                    ref={parentMenuRef}
                    style={{
                      position: 'fixed',
                      top: parentMenuCoords.top,
                      left: parentMenuCoords.left,
                      width: parentMenuCoords.width,
                      zIndex: 9999,
                    }}
                    onClick={e => e.stopPropagation()}
                    className="bg-white border border-lira-border rounded-xl shadow-2xl py-1 max-h-60 overflow-y-auto animate-scale-in"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-lira-muted uppercase tracking-wider border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                      <span>Linked Parent</span>
                      <span className="font-mono text-[9px] bg-gray-200/80 px-1.5 py-0.5 rounded text-lira-text font-semibold">{parentIssue.key}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setParentMenuOpen(false);
                        onClick(parentIssue);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-lira-blue hover:bg-blue-50 font-medium flex items-center gap-2 border-b border-gray-100 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">Open {parentIssue.key} ({parentIssue.title})</span>
                    </button>

                    {eligibleParents.length > 0 && (
                      <>
                        <div className="px-3 pt-2 pb-1 text-[10px] text-lira-muted font-medium bg-gray-50/80">
                          Change parent to:
                        </div>
                        {eligibleParents.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={async () => {
                              setParentMenuOpen(false);
                              if (issue.id && p.id) {
                                await updateIssue(issue.id, {
                                  parentId: p.id,
                                  epicId: p.type === 'epic' ? p.id : (p.epicId || undefined),
                                  epicLink: p.title,
                                });
                              }
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 truncate transition-colors ${
                              p.id === parentIssue.id ? 'bg-blue-50 text-lira-blue font-semibold' : 'text-lira-text'
                            }`}
                          >
                            <span className="text-[10px] font-mono text-lira-muted flex-shrink-0">{p.key}</span>
                            <span className="truncate">{p.title}</span>
                          </button>
                        ))}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        setParentMenuOpen(false);
                        if (issue.id) {
                          await updateIssue(issue.id, { parentId: undefined, epicId: undefined, epicLink: undefined });
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100 font-medium transition-colors"
                    >
                      Unlink parent
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            )}

            {/* Labels */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {labels.slice(0, 3).map(label => (
                  <span key={label} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">
                    {label}
                  </span>
                ))}
                {labels.length > 3 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-lira-muted">
                    +{labels.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Subtask progress */}
            {totalSubtasks > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-lira-muted mb-0.5">
                  <span>{completedSubtasks}/{totalSubtasks} tasks</span>
                  <span>{Math.round((completedSubtasks / totalSubtasks) * 100)}%</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%`, backgroundColor: accentColor ?? '#0052CC' }}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-1.5 min-w-0">
                <TypeIcon type={issue.type} className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold text-lira-muted font-mono">{issue.key}</span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {issue.dueDate && (
                  <div className={`flex items-center gap-1 text-[10px] font-medium ${dueDateColor()}`}>
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDueDate(issue.dueDate)}
                  </div>
                )}
                <span title={priority.label}><PriorityIcon priority={issue.priority} className="w-4 h-4" /></span>
                {issue.assigneeInitials && (
                  <Avatar initials={issue.assigneeInitials} size="xs" color="#0052CC" />
                )}

                {/* Card actions menu */}
                <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 text-lira-muted hover:text-lira-text transition-all"
                    title="Card actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 bottom-6 z-30 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 min-w-[160px] animate-scale-in">
                      <button onClick={() => { setMenuOpen(false); onClick(issue); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-lira-text">
                        <Edit3 className="w-3.5 h-3.5 text-lira-muted" /> Open
                      </button>

                      {/* Link parent option if not linked yet */}
                      {!parentIssue && eligibleParents.length > 0 && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setLinkMenuOpen(true);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 text-lira-text"
                        >
                          <LinkIcon className="w-3.5 h-3.5 text-lira-muted" /> Link to parent...
                        </button>
                      )}

                      <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-lira-muted uppercase tracking-wide">Set status</div>
                      {['backlog', 'todo', 'inprogress', 'done'].map(s => (
                        <button key={s} onClick={e => handleStatusChange(e, s)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-lira-text ${issue.status === s ? 'font-semibold text-lira-blue' : ''}`}>
                          {s === 'backlog' ? 'Backlog' : s === 'todo' ? 'To Do' : s === 'inprogress' ? 'In Progress' : 'Done'}
                        </button>
                      ))}
                      <div className="border-t border-lira-border my-1" />
                      <button onClick={handleDeleteClick}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}

                  {/* Standalone Quick Link Modal if opened via "Link to parent..." */}
                  {linkMenuOpen && (
                    <div
                      ref={linkMenuRef}
                      className="absolute right-0 bottom-6 z-40 bg-white border border-lira-border rounded-lg shadow-dropdown py-1 min-w-[200px] max-w-[260px] max-h-56 overflow-y-auto animate-scale-in"
                    >
                      <div className="px-3 py-1 text-[10px] font-semibold text-lira-muted uppercase tracking-wide border-b border-gray-100">
                        Select Parent
                      </div>
                      {eligibleParents.map(p => (
                        <button
                          key={p.id}
                          onClick={async () => {
                            setLinkMenuOpen(false);
                            if (issue.id && p.id) {
                              await updateIssue(issue.id, {
                                parentId: p.id,
                                epicId: p.type === 'epic' ? p.id : (p.epicId || undefined),
                              });
                            }
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 truncate text-lira-text"
                        >
                          <span className="text-[10px] font-mono text-lira-muted flex-shrink-0">{p.key}</span>
                          <span className="truncate">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Confirmation Popup for Delete */}
          <ConfirmDeleteModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleConfirmDelete}
            issueKey={issue.key}
            issueTitle={issue.title}
            isEpic={issue.type === 'epic'}
          />
        </div>
      )}
    </Draggable>
  );
};
