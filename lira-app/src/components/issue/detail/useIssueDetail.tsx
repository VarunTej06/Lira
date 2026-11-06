import { useState, useEffect, useCallback, useRef } from 'react';
import type { Issue, Comment, IssueType, ActivityEntry } from '../../../types/issue';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { updateIssue, deleteIssue, useChildIssues, createIssue, getNextIssueKey, useIssue, useIssuesBySpace } from '../../../hooks/useIssues';
import { useDebounce } from '../../../hooks/useDebounce';
import { PRIORITY_CONFIG } from '../../../utils/priorityUtils';
import { v4 as uuidv4 } from 'uuid';

export interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onNavigateToIssue?: (issue: Issue) => void;
  parentIssue?: Issue | null;
}

export const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog', color: '#6B778C', bgColor: '#F4F5F7' },
  { value: 'todo', label: 'To Do', color: '#172B4D', bgColor: '#DFE1E6' },
  { value: 'inprogress', label: 'In Progress', color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'done', label: 'Done', color: '#006644', bgColor: '#E3FCEF' },
];

export const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { value: 'epic', label: 'Epic', icon: <span>⚡</span>, color: '#6554C0', bgColor: '#EAE6FF' },
  { value: 'task', label: 'Task', icon: <span>✅</span>, color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'bug', label: 'Bug', icon: <span>🐛</span>, color: '#DE350B', bgColor: '#FFEBE6' },
  { value: 'subtask', label: 'Subtask', icon: <span>↳</span>, color: '#6B778C', bgColor: '#F4F5F7' },
];

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: <span>{cfg.icon}</span>,
  color: cfg.color,
  bgColor: cfg.bgColor,
}));

export const ASSIGNEE_OPTIONS = [
  { value: '', label: 'Unassigned', initials: '' },
  { value: 'Varuntej Yadla', label: 'Varuntej Yadla (VY)', initials: 'VY' },
  { value: 'Alex Morgan', label: 'Alex Morgan (AM)', initials: 'AM' },
  { value: 'Sarah Connor', label: 'Sarah Connor (SC)', initials: 'SC' },
  { value: 'Dev Team', label: 'Dev Team (DT)', initials: 'DT' },
];

export const STATUS_BANNER: Record<string, string> = {
  done: '#36B37E', inprogress: '#FFAB00', todo: '#0052CC', backlog: '#6B778C',
};

export const STATUS_BUTTON_STYLE: Record<string, { bg: string; text: string; hover: string }> = {
  backlog: { bg: '#F4F5F7', text: '#6B778C', hover: '#E4E6EA' },
  todo: { bg: '#DFE1E6', text: '#172B4D', hover: '#C1C7D0' },
  inprogress: { bg: '#DEEBFF', text: '#0052CC', hover: '#B3D4FF' },
  done: { bg: '#E3FCEF', text: '#006644', hover: '#ABF5D1' },
};

// Safe accessor helpers
export const safeArr = <T,>(v: T[] | undefined): T[] => Array.isArray(v) ? v : [];
export const toDateInputValue = (val: Date | string | undefined | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

/** All the state and actions of the ticket popup: the edited copy of the ticket, saving, children, comments, deleting. */
export function useIssueDetail(props: IssueDetailModalProps) {
  const {
    issue,
    onClose,
    onNavigateToIssue,
    parentIssue,
  } = props;
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
  const [savedToast, setSavedToast] = useState(false);
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

  const handleSaveChanges = useCallback(async () => {
    if (!local?.id) return;
    if (!titleVal.trim()) {
      alert('Issue title cannot be empty.');
      return;
    }
    const changes: Partial<Issue> = {
      title: titleVal.trim(),
      description: descVal,
      status: local.status,
      priority: local.priority,
      assignee: local.assignee,
      assigneeInitials: local.assigneeInitials,
      labels: local.labels,
      dueDate: local.dueDate,
      storyPoints: local.storyPoints,
      updatedAt: new Date(),
    };
    await updateIssue(local.id, changes);
    setLocal(prev => prev ? { ...prev, ...changes } : null);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }, [local, titleVal, descVal]);

  const handleAddComment = useCallback(async (comment: Comment) => {
    if (!local) return;
    const newComments = [...safeArr(local.comments), comment];
    await patch({ comments: newComments });
  }, [local, patch]);

  const handleCreateChildIssue = useCallback(async (title: string, type: IssueType) => {
    if (!local?.id || !local.spaceId) return;
    // Get the space key
    const { db } = await import('../../../db/db');
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

  return {
    issue,
    onClose,
    onNavigateToIssue,
    parentIssue,
    local,
    setLocal,
    editingTitle,
    setEditingTitle,
    titleVal,
    setTitleVal,
    descVal,
    setDescVal,
    showStatusMenu,
    setShowStatusMenu,
    showTypeMenu,
    setShowTypeMenu,
    showMoreMenu,
    setShowMoreMenu,
    showDeleteConfirm,
    setShowDeleteConfirm,
    descCollapsed,
    setDescCollapsed,
    attCollapsed,
    setAttCollapsed,
    childCollapsed,
    setChildCollapsed,
    savedToast,
    setSavedToast,
    statusMenuRef,
    typeMenuRef,
    moreMenuRef,
    debouncedDesc,
    childIssues,
    parentFromDb,
    resolvedParent,
    spaceIssues,
    eligibleParents,
    patch,
    handleTypeChange,
    handleParentChange,
    handleTitleSave,
    handleSaveChanges,
    handleAddComment,
    handleCreateChildIssue,
    handleConfirmDelete,
    bannerColor,
    statusStyle,
    typeConfig,
    childCount,
    doneChildCount,
    childProgress,
  };
}

export type IssueDetailState = NonNullable<ReturnType<typeof useIssueDetail>>;
