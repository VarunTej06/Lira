import {  } from '../../common/DatePicker';
import { TypeIcon, PriorityIcon } from '../../common/Icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Issue, Comment, IssueType, ActivityEntry, Attachment } from '../../../types/issue';
import { notifySaved } from '../../common/SavedToast';
import { STATUS_LIST } from '../../../utils/status';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { updateIssue, deleteIssue, useChildIssues, createIssue, getNextIssueKey, useIssue, useIssuesBySpace, useAllIssues } from '../../../hooks/useIssues';
import { confirmDialog, alertDialog } from '../../common/dialogs';
import { PRIORITY_CONFIG } from '../../../utils/priorityUtils';
import { v4 as uuidv4 } from 'uuid';

export interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onNavigateToIssue?: (issue: Issue) => void;
  parentIssue?: Issue | null;
}

export const STATUS_OPTIONS = STATUS_LIST.map(s => ({ value: s.id as string, label: s.label, color: s.color, bgColor: s.bg }));

export const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { value: 'epic', label: 'Epic', icon: <TypeIcon type="epic" />, color: '#6554C0', bgColor: '#EAE6FF' },
  { value: 'task', label: 'Task', icon: <TypeIcon type="task" />, color: '#0052CC', bgColor: '#DEEBFF' },
  { value: 'bug', label: 'Bug', icon: <TypeIcon type="bug" />, color: '#DE350B', bgColor: '#FFEBE6' },
  { value: 'subtask', label: 'Subtask', icon: <TypeIcon type="subtask" />, color: '#6B778C', bgColor: '#F4F5F7' },
];

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: <PriorityIcon priority={value} />,
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

/** The ticket fields that are edited in the popup and written together when "Save changes" is pressed. */
const DRAFT_FIELDS = [
  'status', 'priority', 'assignee', 'assigneeInitials', 'labels', 'dueDate', 'startDate', 'storyPoints', 'type',
  'parentId', 'epicId', 'epicLink', 'attachments', 'subtasks', 'activity', 'timeEstimate', 'blocked', 'blockedByIds', 'blockedAt', 'linkedIssues',
] as const satisfies readonly (keyof Issue)[];

// Safe accessor helpers
export const safeArr = <T,>(v: T[] | undefined): T[] => Array.isArray(v) ? v : [];
export const toDateInputValue = (val: Date | string | undefined | null): string => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // the local day
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
  /** Set when the type was changed to Subtask and its children should be detached once the ticket is saved. */
  const [detachChildren, setDetachChildren] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Get child issues from DB reactively
  const childIssues = useChildIssues(local?.id) || [];
  const parentFromDb = useIssue(local?.parentId ?? local?.epicId);
  const resolvedParent = parentIssue ?? parentFromDb ?? null;
  const spaceIssues = useIssuesBySpace(local?.spaceId) || [];
  const everyIssue = useAllIssues() || [];
  const blockers = (local?.blocked ? local.blockedByIds ?? [] : []).map(id => everyIssue.find(i => i.id === id)).filter((i): i is Issue => !!i);
  const blocking = local?.id ? everyIssue.filter(i => i.blocked && i.blockedByIds?.includes(local.id!)) : []; // tickets waiting on this one

  // Eligible parent issues according to the hierarchy
  const eligibleParents = spaceIssues.filter(i => {
    if (!local?.id || i.id === local.id) return false;
    if (local.type === 'subtask') return i.type === 'task' || i.type === 'bug';
    if (local.type === 'task') return i.type === 'epic';
    if (local.type === 'bug') return i.type === 'epic' || i.type === 'task';
    return false;
  });

  // Everything edited in the popup is a DRAFT. Nothing is written until "Save changes" is pressed.
  useEffect(() => {
    setLocal(issue ? { ...issue } : null);
    setTitleVal(issue?.title ?? '');
    setDescVal(issue?.description ?? '');
    setEditingTitle(false);
    setDetachChildren(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?.id]);

  // Comments are posted with their own button and saved at once, so keep the draft in step with them
  useEffect(() => {
    if (!issue) return;
    setLocal(prev => (prev && prev.id === issue.id ? { ...prev, comments: issue.comments } : prev));
  }, [issue?.comments, issue?.id]);

  // Has anything been changed since the ticket was opened?
  const dirty = !!issue && !!local && (
    titleVal.trim() !== issue.title ||
    descVal !== (issue.description ?? '') ||
    detachChildren ||
    DRAFT_FIELDS.some(k => JSON.stringify(local[k] ?? null) !== JSON.stringify(issue[k] ?? null))
  );

  // Closing (X, outside click, Escape) asks first when there are unsaved changes
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const requestClose = useCallback(async () => {
    if (!dirtyRef.current) { onClose(); return; }
    const discard = await confirmDialog({
      title: 'Discard changes?',
      message: 'You have unsaved changes to this ticket. If you close it now they are lost.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });
    if (discard) onClose();
  }, [onClose]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') void requestClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [requestClose]);

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

  /** Edits the draft only. Nothing is saved until "Save changes". */
  const patch = useCallback(async (changes: Partial<Issue>) => {
    setLocal(prev => (prev ? { ...prev, ...changes } : prev));
  }, []);

  /** Turns the Blocked switch on (with the ticket it waits on) or off. It edits the draft; Save changes writes it. */
  const handleBlockedChange = useCallback((ids: number[]) => {
    setLocal(prev => {
      if (!prev) return prev;
      const unique = [...new Set(ids)];
      const others = safeArr(prev.linkedIssues).filter(l => l.linkType !== 'blocked_by');
      if (unique.length === 0) return { ...prev, blocked: false, blockedByIds: [], blockedAt: undefined, linkedIssues: others };
      return { ...prev, blocked: true, blockedByIds: unique, blockedAt: prev.blocked && prev.blockedAt ? prev.blockedAt : new Date().toISOString(), linkedIssues: [...others, ...unique.map(id => ({ id: uuidv4(), issueId: id, linkType: 'blocked_by' as const }))] };
    });
  }, []);

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
      const confirmDetach = await confirmDialog({
        title: 'Convert to subtask',
        message: `Converting ${local.key} to a subtask will detach its ${childIssues.length} child issue${childIssues.length === 1 ? '' : 's'} when you save, because subtasks cannot have child issues.`,
        confirmLabel: 'Convert',
      });
      if (!confirmDetach) return;
      setDetachChildren(true);
    } else if (newType !== 'subtask') {
      setDetachChildren(false);
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

  // Leaving the title box keeps the text as part of the draft; it is saved with everything else
  const handleTitleSave = useCallback(async () => {
    setEditingTitle(false);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!local?.id) return;
    // nothing was changed: just close, and do not claim that something was saved
    if (!dirtyRef.current) { onClose(); return; }
    if (!titleVal.trim()) {
      await alertDialog({ title: 'Title needed', message: 'The title cannot be empty.' });
      return;
    }
    const changes: Partial<Issue> = { title: titleVal.trim(), description: descVal, updatedAt: new Date() };
    for (const k of DRAFT_FIELDS) (changes as Record<string, unknown>)[k] = local[k];
    if (detachChildren) {
      for (const child of childIssues) {
        if (child.id) await updateIssue(child.id, { parentId: undefined, epicId: undefined, epicLink: undefined });
      }
    }
    await updateIssue(local.id, changes);
    // keep the other end of the link in step: the blocking ticket "blocks" this one
    const before = issue?.blocked ? issue.blockedByIds ?? [] : [];
    const after = local.blocked ? local.blockedByIds ?? [] : [];
    const removed = before.filter(id => !after.includes(id));
    const added = after.filter(id => !before.includes(id));
    if (removed.length || added.length) {
      const { db } = await import('../../../db/db');
      for (const id of removed) {
        const old = await db.issues.get(id);
        if (old) await updateIssue(id, { linkedIssues: safeArr(old.linkedIssues).filter(l => !(l.linkType === 'blocks' && l.issueId === local.id)) });
      }
      for (const id of added) {
        const nb = await db.issues.get(id);
        if (nb && !safeArr(nb.linkedIssues).some(l => l.linkType === 'blocks' && l.issueId === local.id)) {
          await updateIssue(id, { linkedIssues: [...safeArr(nb.linkedIssues), { id: uuidv4(), issueId: local.id, linkType: 'blocks' as const }] });
        }
      }
    }
    notifySaved('Changes saved');
    onClose(); // saving closes the ticket
  }, [local, issue, titleVal, descVal, detachChildren, childIssues, onClose]);

  const handleAddComment = useCallback(async (comment: Comment) => {
    if (!local) return;
    if (!local.id) return;
    const newComments = [...safeArr(local.comments), comment];
    setLocal(prev => (prev ? { ...prev, comments: newComments } : prev));
    await updateIssue(local.id, { comments: newComments });
  }, [local]);

  /** Comments are saved at once, like posting one. Only the author's own comment can be changed. */
  const handleEditComment = useCallback(async (id: string, content: string, attachments: Attachment[]) => {
    if (!local?.id) return;
    const next = safeArr(local.comments).map(c => (c.id === id ? { ...c, content, attachments, updatedAt: new Date() } : c));
    setLocal(prev => (prev ? { ...prev, comments: next } : prev));
    await updateIssue(local.id, { comments: next });
  }, [local]);

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
    onClose: requestClose,
    dirty,
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
    handleEditComment,
    handleCreateChildIssue,
    handleConfirmDelete,
    bannerColor,
    statusStyle,
    blockers,
    blocking,
    handleBlockedChange,
    typeConfig,
    childCount,
    doneChildCount,
    childProgress,
  };
}

export type IssueDetailState = NonNullable<ReturnType<typeof useIssueDetail>>;
