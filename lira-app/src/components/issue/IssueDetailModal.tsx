import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Maximize2, Share2, MoreHorizontal, Eye, Plus,
  ChevronDown, ChevronRight, Paperclip, AlertTriangle,
  Zap, Settings, Clock, Tag, Users, Calendar,
  CheckSquare, Trash2, ExternalLink, Link, Target, Layers
} from 'lucide-react';
import type { Issue, Comment, Priority, IssueType, IssueStatus, ActivityEntry } from '../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../types/issue';
import { updateIssue, deleteIssue, useChildIssues, createIssue, getNextIssueKey, useIssue, useIssuesBySpace } from '../../hooks/useIssues';
import { useDebounce } from '../../hooks/useDebounce';
import { IssueSubtasks } from './IssueSubtasks';
import { IssueAttachments } from './IssueAttachments';
import { IssueActivityFeed } from './IssueActivityFeed';
import { ChildIssues } from './ChildIssues';
import { SelectDropdown } from '../common/Dropdown';
import { Avatar } from '../common/Avatar';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { PRIORITY_CONFIG } from '../../utils/priorityUtils';
import { formatRelativeDate, formatTimeTracking } from '../../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onNavigateToIssue?: (issue: Issue) => void;
  parentIssue?: Issue | null;
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog', color: '#6B778C', bgColor: '#F4F5F7' },
  { value: 'todo', label: 'To Do', color: '#172B4D', bgColor: '#DFE1E6' },
  { value: 'inprogress', label: 'In Progress', color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'done', label: 'Done', color: '#006644', bgColor: '#E3FCEF' },
];

const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { value: 'epic', label: 'Epic', icon: <span>⚡</span>, color: '#6554C0', bgColor: '#EAE6FF' },
  { value: 'task', label: 'Task', icon: <span>✅</span>, color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'bug', label: 'Bug', icon: <span>🐛</span>, color: '#DE350B', bgColor: '#FFEBE6' },
  { value: 'subtask', label: 'Subtask', icon: <span>↳</span>, color: '#6B778C', bgColor: '#F4F5F7' },
];

const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: <span>{cfg.icon}</span>,
  color: cfg.color,
  bgColor: cfg.bgColor,
}));

const STATUS_BANNER: Record<string, string> = {
  done: '#36B37E', inprogress: '#FFAB00', todo: '#0052CC', backlog: '#6B778C',
};

const STATUS_BUTTON_STYLE: Record<string, { bg: string; text: string; hover: string }> = {
  backlog: { bg: '#F4F5F7', text: '#6B778C', hover: '#E4E6EA' },
  todo: { bg: '#DFE1E6', text: '#172B4D', hover: '#C1C7D0' },
  inprogress: { bg: '#DEEBFF', text: '#0052CC', hover: '#B3D4FF' },
  done: { bg: '#E3FCEF', text: '#006644', hover: '#ABF5D1' },
};

// Safe accessor helpers
const safeArr = <T,>(v: T[] | undefined): T[] => Array.isArray(v) ? v : [];
const toDateInputValue = (val: Date | string | undefined | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  onClose,
  onNavigateToIssue,
  parentIssue,
}) => {
  const [local, setLocal] = useState<Issue | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [descCollapsed, setDescCollapsed] = useState(false);
  const [attCollapsed, setAttCollapsed] = useState(false);
  const [childCollapsed, setChildCollapsed] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const debouncedDesc = useDebounce(descVal, 800);

  // Get child issues from DB reactively
  const childIssues = useChildIssues(local?.id) || [];
  const parentFromDb = useIssue(local?.parentId ?? local?.epicId);
  const resolvedParent = parentIssue ?? parentFromDb ?? null;
  const spaceIssues = useIssuesBySpace(local?.spaceId) || [];

  // Eligible parent issues according to the hierarchy
  const eligibleParents = spaceIssues.filter(i => {
    if (!local?.id || i.id === local.id) return false;
    if (local.type === 'subtask') return i.type === 'task' || i.type === 'bug';
    if (local.type === 'task') return i.type === 'epic';
    if (local.type === 'bug') return i.type === 'epic' || i.type === 'task';
    return false;
  });

  useEffect(() => {
    setLocal(issue ? { ...issue } : null);
    setTitleVal(issue?.title ?? '');
    setDescVal(issue?.description ?? '');
    setEditingTitle(false);
  }, [issue]);

  // Auto-save description
  useEffect(() => {
    if (!local?.id || debouncedDesc === local.description) return;
    updateIssue(local.id, { description: debouncedDesc });
    setLocal(prev => prev ? { ...prev, description: debouncedDesc } : prev);
  }, [debouncedDesc]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) setShowTypeMenu(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const patch = useCallback(async (changes: Partial<Issue>) => {
    if (!local?.id) return;
    const updated = { ...local, ...changes, updatedAt: new Date() };
    setLocal(updated);
    await updateIssue(local.id, changes);
  }, [local]);

  const handleTypeChange = useCallback(async (newType: IssueType) => {
    if (!local?.id || local.type === newType) return;
    const oldType = local.type;
    const oldTypeCfg = ISSUE_TYPE_CONFIG[oldType]?.label || oldType;
    const newTypeCfg = ISSUE_TYPE_CONFIG[newType]?.label || newType;

    const changes: Partial<Issue> = { type: newType };

    // Hierarchy Impact 1: Upgrading to Epic -> Epics have no parents in hierarchy
    if (newType === 'epic') {
      changes.parentId = undefined;
      changes.epicId = undefined;
      changes.epicLink = undefined;
    }

    // Hierarchy Impact 2: Converting to Subtask -> cannot have child issues
    if (newType === 'subtask' && childIssues.length > 0) {
      const confirmDetach = window.confirm(
        `Converting ${local.key} to Subtask will detach its ${childIssues.length} child issue(s), because subtasks cannot have child issues. Proceed?`
      );
      if (!confirmDetach) return;
      for (const child of childIssues) {
        if (child.id) {
          await updateIssue(child.id, { parentId: undefined, epicId: undefined, epicLink: undefined });
        }
      }
    }

    // Hierarchy Impact 3: Activity log entry
    const now = new Date();
    const activityEntry: ActivityEntry = {
      id: uuidv4(),
      type: 'field_change',
      author: 'VY',
      authorInitials: 'VY',
      description: `changed issue type from ${oldTypeCfg} to ${newTypeCfg}`,
      oldValue: oldTypeCfg,
      newValue: newTypeCfg,
      createdAt: now,
    };
    changes.activity = [activityEntry, ...safeArr(local.activity)];

    await patch(changes);
  }, [local, childIssues, patch]);

  const handleParentChange = useCallback(async (newParentId: number | undefined) => {
    if (!local?.id) return;
    if (!newParentId) {
      await patch({
        parentId: undefined,
        epicId: undefined,
        epicLink: undefined,
      });
      return;
    }
    const parent = spaceIssues.find(i => i.id === newParentId);
    if (!parent) return;

    await patch({
      parentId: parent.id,
      epicId: parent.type === 'epic' ? parent.id : (parent.epicId || undefined),
      epicLink: parent.title,
    });
  }, [local, spaceIssues, patch]);

  const handleTitleSave = useCallback(async () => {
    setEditingTitle(false);
    if (titleVal.trim() && titleVal !== local?.title) {
      await patch({ title: titleVal.trim() });
    }
  }, [titleVal, local, patch]);

  const handleAddComment = useCallback(async (comment: Comment) => {
    if (!local) return;
    const newComments = [...safeArr(local.comments), comment];
    await patch({ comments: newComments });
  }, [local, patch]);

  const handleCreateChildIssue = useCallback(async (title: string, type: IssueType) => {
    if (!local?.id || !local.spaceId) return;
    // Get the space key
    const { db } = await import('../../db/db');
    const space = await db.spaces.get(local.spaceId);
    if (!space) return;
    const key = await getNextIssueKey(space.key);
    const now = new Date();
    await createIssue({
      spaceId: local.spaceId,
      key,
      parentId: local.id,
      epicId: local.type === 'epic' ? local.id : local.epicId,
      title,
      description: '',
      type,
      status: 'todo',
      priority: 'medium',
      assignee: local.assignee,
      assigneeInitials: local.assigneeInitials,
      reporter: 'VY',
      reporterInitials: 'VY',
      labels: [],
      subtasks: [],
      comments: [],
      activity: [{ id: uuidv4(), type: 'created', author: 'VY', authorInitials: 'VY', description: 'created this issue', createdAt: now }],
      attachments: [],
      linkedIssues: [],
      rank: Date.now(),
      createdAt: now,
      updatedAt: now,
      watchers: ['VY'],
    });
  }, [local]);

  const handleConfirmDelete = useCallback(async () => {
    if (!local?.id) return;
    await deleteIssue(local.id);
    setShowDeleteConfirm(false);
    onClose();
  }, [local, onClose]);

  if (!local) return null;

  const bannerColor = STATUS_BANNER[local.status] ?? '#DFE1E6';
  const statusStyle = STATUS_BUTTON_STYLE[local.status] ?? STATUS_BUTTON_STYLE.todo;
  const typeConfig = ISSUE_TYPE_CONFIG[local.type] ?? ISSUE_TYPE_CONFIG.task;

  const childCount = childIssues.length;
  const doneChildCount = childIssues.filter(c => c.status === 'done').length;
  const childProgress = childCount > 0 ? Math.round((doneChildCount / childCount) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-modal w-full flex flex-col overflow-hidden animate-scale-in"
        style={{ maxWidth: '1120px', maxHeight: '93vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Status colour banner */}
        <div className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: bannerColor }} />

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-jira-border flex-shrink-0 bg-white">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            {resolvedParent && (
              <>
                <button
                  onClick={() => onNavigateToIssue?.(resolvedParent)}
                  className="flex items-center gap-1 text-xs text-jira-blue hover:underline font-medium"
                >
                  <span style={{ color: ISSUE_TYPE_CONFIG[resolvedParent.type]?.color }}>
                    {ISSUE_TYPE_CONFIG[resolvedParent.type]?.symbol}
                  </span>
                  {resolvedParent.key}
                </button>
                <ChevronRight className="w-3 h-3 text-jira-muted flex-shrink-0" />
              </>
            )}
            {/* Type selector dropdown */}
            <div className="relative" ref={typeMenuRef}>
              <button
                type="button"
                onClick={() => setShowTypeMenu(v => !v)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold hover:opacity-85 transition-opacity cursor-pointer group"
                style={{ color: typeConfig.color, backgroundColor: typeConfig.bg }}
                title="Click to convert/change issue type"
              >
                <span>{typeConfig.symbol}</span>
                <span>{typeConfig.label}</span>
                <span className="font-mono">{local.key}</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
              {showTypeMenu && (
                <div className="absolute left-0 top-8 z-50 bg-white border border-jira-border rounded-lg shadow-dropdown py-1 min-w-[160px] animate-scale-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-jira-muted uppercase tracking-wider border-b border-gray-100">
                    Change Issue Type
                  </div>
                  {ISSUE_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setShowTypeMenu(false);
                        handleTypeChange(opt.value as IssueType);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                        opt.value === local.type ? 'bg-blue-50/70 font-semibold text-jira-blue' : 'text-jira-text'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                      {opt.value === local.type && <span className="ml-auto text-jira-blue text-[11px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: utility actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-jira-muted bg-gray-100 rounded px-2 py-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{safeArr(local.watchers).length}</span>
            </div>
            <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Share">
              <Share2 className="w-4 h-4" />
            </button>

            {/* More menu */}
            <div ref={moreMenuRef} className="relative">
              <button
                onClick={() => setShowMoreMenu(m => !m)}
                className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-8 z-50 bg-white border border-jira-border rounded-lg shadow-dropdown py-1 min-w-[180px] animate-scale-in">
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-jira-text">
                    <Link className="w-3.5 h-3.5 text-jira-muted" /> Copy link
                  </button>
                  <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-jira-text">
                    <ExternalLink className="w-3.5 h-3.5 text-jira-muted" /> Open in full page
                  </button>
                  <div className="border-t border-jira-border my-1" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete issue
                  </button>
                </div>
              )}
            </div>

            <button className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors" title="Fullscreen">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-jira-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── BODY: Two columns ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── LEFT: Main content ── */}
          <div className="flex-1 overflow-y-auto min-w-0 px-6 pt-4 pb-10 space-y-5">

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

          {/* ── RIGHT: Details sidebar ── */}
          <div className="w-72 flex-shrink-0 border-l border-jira-border overflow-y-auto bg-gray-50/40">
            {/* Status button — prominent at top like Jira */}
            <div className="px-4 pt-4 pb-3 border-b border-jira-border space-y-2">
              <div ref={statusMenuRef} className="relative">
                <button
                  onClick={() => setShowStatusMenu(m => !m)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all w-full"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  <span className="flex-1 text-left">{STATUS_OPTIONS.find(s => s.value === local.status)?.label ?? local.status}</span>
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                </button>
                {showStatusMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-jira-border rounded-lg shadow-dropdown py-1 animate-scale-in">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { patch({ status: opt.value as IssueStatus }); setShowStatusMenu(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: opt.color, backgroundColor: opt.bgColor }}>
                          {opt.label}
                        </span>
                        {local.status === opt.value && <span className="ml-auto text-jira-blue text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Automations button */}
              <button className="flex items-center gap-2 px-3 py-1.5 w-full text-xs text-jira-muted border border-jira-border rounded-lg hover:bg-white transition-colors">
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                <span>Automations</span>
              </button>
            </div>

            {/* Details section */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-jira-muted mb-3 uppercase tracking-wider flex items-center justify-between">
                Details
                <Settings className="w-3.5 h-3.5 cursor-pointer hover:text-jira-text" />
              </p>

              <div className="space-y-0">
                {/* Type Selector */}
                <DetailRow icon={<Layers className="w-3.5 h-3.5" />} label="Type">
                  <SelectDropdown
                    value={local.type}
                    options={ISSUE_TYPE_OPTIONS}
                    onChange={v => handleTypeChange(v as IssueType)}
                  />
                </DetailRow>

                {/* Parent in Hierarchy */}
                {local.type !== 'epic' ? (
                  <DetailRow icon={<Target className="w-3.5 h-3.5" />} label="Parent">
                    <div className="flex items-center gap-1.5 w-full">
                      <select
                        value={local.parentId || (resolvedParent ? resolvedParent.id : '') || ''}
                        onChange={e => {
                          const val = e.target.value;
                          handleParentChange(val ? Number(val) : undefined);
                        }}
                        className="w-full text-xs text-jira-text bg-white border border-jira-border hover:border-gray-400 rounded px-2 py-1 outline-none focus:border-jira-blue transition-colors cursor-pointer truncate"
                        title="Select parent issue according to hierarchy"
                      >
                        <option value="">None (No parent)</option>
                        {eligibleParents.map(p => (
                          <option key={p.id} value={p.id}>
                            [{p.key}] {p.title} ({p.type})
                          </option>
                        ))}
                      </select>
                      {resolvedParent && (
                        <button
                          type="button"
                          onClick={() => onNavigateToIssue?.(resolvedParent)}
                          className="p-1 hover:bg-gray-100 rounded text-jira-muted hover:text-jira-blue transition-colors flex-shrink-0"
                          title={`Go to parent ${resolvedParent.key}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </DetailRow>
                ) : (
                  <DetailRow icon={<Target className="w-3.5 h-3.5" />} label="Parent">
                    <span className="text-xs text-jira-muted italic">Epics are top-level hierarchy containers</span>
                  </DetailRow>
                )}

                <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Assignee">
                  <div className="flex items-center gap-2">
                    {local.assigneeInitials
                      ? <><Avatar initials={local.assigneeInitials} size="xs" /><span className="text-sm text-jira-text">{local.assignee || local.assigneeInitials}</span></>
                      : <span className="text-sm text-jira-muted">Unassigned</span>
                    }
                  </div>
                </DetailRow>

                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Due date">
                  <input
                    type="date"
                    value={toDateInputValue(local.dueDate)}
                    onChange={e => patch({ dueDate: e.target.value ? new Date(e.target.value) : undefined })}
                    className="text-sm text-jira-text border-none outline-none bg-transparent cursor-pointer w-full"
                  />
                </DetailRow>

                <DetailRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Priority">
                  <SelectDropdown
                    value={local.priority}
                    options={PRIORITY_OPTIONS}
                    onChange={v => patch({ priority: v as Priority })}
                  />
                </DetailRow>

                <DetailRow icon={<Tag className="w-3.5 h-3.5" />} label="Labels">
                  <div className="flex flex-wrap gap-1">
                    {safeArr(local.labels).map(label => (
                      <span key={label} className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full font-medium">
                        {label}
                        <button onClick={() => patch({ labels: local.labels!.filter(l => l !== label) })} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                    <LabelAdder onAdd={l => patch({ labels: [...safeArr(local.labels), l] })} />
                  </div>
                </DetailRow>

                {/* Time tracking */}
                {(local.timeEstimate || local.timeLogged) && (
                  <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Time tracking">
                    <div className="w-full">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(((local.timeLogged ?? 0) / (local.timeEstimate ?? 1)) * 100))}%`,
                            backgroundColor: '#0052CC',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-jira-muted">
                        <span>{formatTimeTracking(local.timeLogged ?? 0)} logged</span>
                        <span>{formatTimeTracking(local.timeEstimate ?? 0)} est.</span>
                      </div>
                    </div>
                  </DetailRow>
                )}

                <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Start date">
                  <input
                    type="date"
                    value={toDateInputValue(local.startDate)}
                    onChange={e => patch({ startDate: e.target.value ? new Date(e.target.value) : undefined })}
                    className="text-sm text-jira-text border-none outline-none bg-transparent cursor-pointer w-full"
                  />
                </DetailRow>

                {local.category !== undefined && (
                  <DetailRow icon={<Tag className="w-3.5 h-3.5" />} label="Category">
                    <span className="text-sm text-jira-text">{local.category || 'Add option'}</span>
                  </DetailRow>
                )}

                <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Reporter">
                  <div className="flex items-center gap-2">
                    <Avatar initials={local.reporterInitials || 'VY'} size="xs" />
                    <span className="text-sm text-jira-text">{local.reporter || local.reporterInitials || 'VY'}</span>
                  </div>
                </DetailRow>

                {local.storyPoints !== undefined && (
                  <DetailRow icon={<CheckSquare className="w-3.5 h-3.5" />} label="Story points">
                    <span className="text-sm font-semibold text-jira-text">{local.storyPoints}</span>
                  </DetailRow>
                )}
              </div>
            </div>

            {/* Automation & Metadata */}
            <div className="px-4 py-3 border-t border-jira-border">
              <button className="flex items-center gap-2 text-xs font-semibold text-jira-muted mb-3 hover:text-jira-text w-full">
                <Zap className="w-3.5 h-3.5 text-yellow-500" />
                Automation
              </button>
              <div className="bg-white border border-jira-border rounded-lg p-3 space-y-2 text-xs text-jira-muted">
                <div className="flex justify-between">
                  <span>Recent rule runs</span>
                  <button className="text-jira-blue hover:underline">Configure</button>
                </div>
                <div className="flex justify-between"><span>Created</span><span>{formatRelativeDate(local.createdAt)}</span></div>
                <div className="flex justify-between"><span>Updated</span><span>{formatRelativeDate(local.updatedAt)}</span></div>
                {local.resolvedAt && <div className="flex justify-between"><span>Resolved</span><span>{formatRelativeDate(local.resolvedAt)}</span></div>}
                {local.epicLink && (
                  <div className="flex justify-between">
                    <span>Epic</span>
                    <span className="text-purple-600 font-medium">{local.epicLink}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Issue Deletion */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        issueKey={local.key}
        issueTitle={local.title}
        childCount={childCount}
        isEpic={local.type === 'epic'}
      />
    </div>
  );
};

// Reusable detail row
const DetailRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-1.5 w-24 flex-shrink-0 text-xs text-jira-muted mt-1.5">
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
    <div className="flex-1 min-w-0 mt-0.5">{children}</div>
  </div>
);

// Inline label adder
const LabelAdder: React.FC<{ onAdd: (l: string) => void }> = ({ onAdd }) => {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  if (adding) {
    return (
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); setAdding(false); }
          if (e.key === 'Escape') setAdding(false);
        }}
        onBlur={() => setAdding(false)}
        className="text-xs border border-jira-blue rounded-full px-2 py-0.5 outline-none w-20"
        placeholder="label"
      />
    );
  }
  return (
    <button onClick={() => setAdding(true)} className="px-1.5 py-0.5 text-xs text-jira-muted hover:text-jira-blue border border-dashed border-jira-border hover:border-jira-blue rounded-full transition-colors">
      + Add
    </button>
  );
};
