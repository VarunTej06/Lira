import { useState, useEffect, useCallback, useRef } from 'react';
import type { Issue, Comment, IssueType, ActivityEntry, Attachment } from '../../../types/issue';
import { notifySaved } from '../../common/SavedToast';
import { ISSUE_TYPE_CONFIG } from '../../../types/issue';
import { updateIssue, deleteIssue, useChildIssues, createIssue, getNextIssueKey, useIssue, useIssuesBySpace, useAllIssues } from '../../../hooks/useIssues';
import { confirmDialog, alertDialog } from '../../common/dialogs';
import { v4 as uuidv4 } from 'uuid';
import { STATUS_BANNER, STATUS_BUTTON_STYLE, safeArr } from './issueOptions';
import { canBeParent } from '../../../utils/hierarchy';
import { buildNewIssue } from '../../../utils/newIssue';
import { syncBlockLinks } from './blockLinks';
import { useDetailMenus } from './useDetailMenus';
import { db } from '../../../db/db';
import { currentUser } from '../../../utils/currentUser';

export interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onNavigateToIssue?: (issue: Issue) => void;
  parentIssue?: Issue | null;
}

/** The ticket fields that are edited in the popup and written together when "Save changes" is pressed. */
const DRAFT_FIELDS = [
  'status', 'priority', 'assignee', 'assigneeInitials', 'labels', 'dueDate', 'startDate', 'storyPoints', 'type',
  'parentId', 'epicId', 'epicLink', 'attachments', 'subtasks', 'activity', 'timeEstimate', 'blocked', 'blockedByIds', 'blockedAt', 'linkedIssues',
] as const satisfies readonly (keyof Issue)[];

/** All the state and actions of the ticket popup: the edited copy of the ticket, saving, children, comments, deleting. */
export function useIssueDetail(props: IssueDetailModalProps) {
  const {
    issue,
    onClose,
    onNavigateToIssue,
    parentIssue,
  } = props;
  const [local, setLocal] = useState<Issue | null>(null);
  const menus = useDetailMenus();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  /** Set when the type was changed to Subtask and its children should be detached once the ticket is saved. */
  const [detachChildren, setDetachChildren] = useState(false);

  // Get child issues from DB reactively
  const childIssues = useChildIssues(local?.id) || [];
  const parentFromDb = useIssue(local?.parentId ?? local?.epicId);
  const resolvedParent = parentIssue ?? parentFromDb ?? null;
  const spaceIssues = useIssuesBySpace(local?.spaceId) || [];
  const everyIssue = useAllIssues() || [];
  const blockers = (local?.blocked ? local.blockedByIds ?? [] : []).map(id => everyIssue.find(i => i.id === id)).filter((i): i is Issue => !!i);
  const blocking = local?.id ? everyIssue.filter(i => i.blocked && i.blockedByIds?.includes(local.id!)) : []; // tickets waiting on this one

  // Eligible parent issues according to the hierarchy
  const eligibleParents = local?.id ? spaceIssues.filter(i => canBeParent(local, i)) : [];

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
      author: currentUser().initials,
      authorInitials: currentUser().initials,
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
    await syncBlockLinks(local.id, issue?.blocked ? issue.blockedByIds ?? [] : [], local.blocked ? local.blockedByIds ?? [] : []);
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
    const space = await db.spaces.get(local.spaceId);
    if (!space) return;
    await createIssue(buildNewIssue({
      spaceId: local.spaceId, key: await getNextIssueKey(space.key), parentId: local.id, spaceIssues: [local],
      title, description: '', type, status: 'todo', priority: 'medium', dueDate: '', labels: '', attachments: [],
      assignee: { name: local.assignee, initials: local.assigneeInitials },
    }));
  }, [local]);

  const handleConfirmDelete = useCallback(async () => {
    if (!local?.id) return;
    await deleteIssue(local.id);
    menus.setShowDeleteConfirm(false);
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
    ...menus,
    editingTitle,
    setEditingTitle,
    titleVal,
    setTitleVal,
    descVal,
    setDescVal,
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
