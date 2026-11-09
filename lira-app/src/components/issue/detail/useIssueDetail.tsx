import { useCallback } from 'react';
import type { Issue, IssueType } from '../../../types/issue';
import { notifySaved } from '../../common/savedToastStore';

import { deleteIssue, useChildIssues, useIssue, useIssuesBySpace, useAllIssues } from '../../../hooks/useIssues';
import { confirmDialog, alertDialog } from '../../common/dialogStore';
import { commitTicket, createChildOf } from './ticketWrites';
import { useDetailMenus } from './useDetailMenus';
import { useIssueDraft } from './useIssueDraft';

import { NO_ISSUES } from '../../../utils/emptyLists';

import { useCloseGuard } from './useCloseGuard';
import { useCommentActions } from './useCommentActions';
import { childStats, lookFor, relatedTickets, isDirty, parentFields, typeChangeFields, withBlockers } from './ticketDraft';

export interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onNavigateToIssue?: (issue: Issue) => void;
  parentIssue?: Issue | null;
}

/** All the state and actions of the ticket popup: the edited copy of the ticket, saving, children, comments, deleting. */
export function useIssueDetail(props: IssueDetailModalProps) {
  const {
    issue,
    onClose,
    onNavigateToIssue,
    parentIssue,
  } = props;
  const { local, setLocal, editingTitle, setEditingTitle, titleVal, setTitleVal, descVal, setDescVal, detachChildren, setDetachChildren } = useIssueDraft(issue);
  const menus = useDetailMenus();
  const { setShowDeleteConfirm } = menus;

  // Get child issues from DB reactively
  const childIssues = useChildIssues(local?.id) ?? NO_ISSUES;
  const parentFromDb = useIssue(local?.parentId ?? local?.epicId);
  const resolvedParent = parentIssue ?? parentFromDb ?? null;
  const spaceIssues = useIssuesBySpace(local?.spaceId) ?? NO_ISSUES;
  const everyIssue = useAllIssues() ?? NO_ISSUES;
  // what blocks this ticket, what waits on it, and which tickets could be its parent (by the hierarchy)
  const { blockers, blocking, eligibleParents } = relatedTickets(local, everyIssue, spaceIssues);

  // Has anything been changed since the ticket was opened?
  const dirty = isDirty(issue, local, titleVal, descVal, detachChildren);

  // Closing (X, outside click, Escape) asks first when there are unsaved changes
  const { requestClose, dirtyRef } = useCloseGuard(dirty, onClose);

  /** Edits the draft only. Nothing is saved until "Save changes". */
  const patch = useCallback(async (changes: Partial<Issue>) => {
    setLocal(prev => (prev ? { ...prev, ...changes } : prev));
  }, [setLocal]);

  /** Turns the Blocked switch on (with the ticket it waits on) or off. It edits the draft; Save changes writes it. */
  const handleBlockedChange = useCallback((ids: number[]) => {
    setLocal(prev => (prev ? withBlockers(prev, ids) : prev));
  }, [setLocal]);

  const handleTypeChange = useCallback(async (newType: IssueType) => {
    if (!local?.id || local.type === newType) return;
    const changes = typeChangeFields(local, newType);

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

    await patch(changes);
  }, [local, childIssues, patch, setDetachChildren]);

  const handleParentChange = useCallback(async (newParentId: number | undefined) => {
    if (!local?.id) return;
    const parent = newParentId ? spaceIssues.find(i => i.id === newParentId) : undefined;
    if (newParentId && !parent) return;
    await patch(parentFields(parent));
  }, [local, spaceIssues, patch]);

  // Leaving the title box keeps the text as part of the draft; it is saved with everything else
  const handleTitleSave = useCallback(async () => {
    setEditingTitle(false);
  }, [setEditingTitle]);

  const handleSaveChanges = useCallback(async () => {
    if (!local?.id) return;
    // nothing was changed: just close, and do not claim that something was saved
    if (!dirtyRef.current) { onClose(); return; }
    if (!titleVal.trim()) {
      await alertDialog({ title: 'Title needed', message: 'The title cannot be empty.' });
      return;
    }
    await commitTicket({ local, original: issue, title: titleVal, description: descVal, detachChildren, children: childIssues });
    notifySaved('Changes saved');
    onClose(); // saving closes the ticket
  }, [local, issue, titleVal, descVal, detachChildren, childIssues, onClose, dirtyRef]);

  const { handleAddComment, handleEditComment } = useCommentActions(local, setLocal);

  const handleCreateChildIssue = useCallback(async (title: string, type: IssueType) => {
    if (local) await createChildOf(local, title, type);
  }, [local]);

  const handleConfirmDelete = useCallback(async () => {
    if (!local?.id) return;
    await deleteIssue(local.id);
    setShowDeleteConfirm(false);
    onClose();
  }, [local, onClose, setShowDeleteConfirm]);

  if (!local) return null;

  const { bannerColor, statusStyle, typeConfig } = lookFor(local);

  const { childCount, doneChildCount, childProgress } = childStats(childIssues);

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
