import { useEffect, useState } from 'react';
import type { Issue } from '../../../types/issue';

/**
 * The edited copy ("draft") of the ticket in the popup: the ticket itself, the title and description being typed, whether the title
 * box is open, and whether children should be detached on save. A new ticket starts a fresh draft. Nothing here is written anywhere.
 */
export function useIssueDraft(issue: Issue | null) {
  const [local, setLocal] = useState<Issue | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  /** Set when the type was changed to Subtask and its children should be detached once the ticket is saved. */
  const [detachChildren, setDetachChildren] = useState(false);

  useEffect(() => {
    setLocal(issue ? { ...issue } : null);
    setTitleVal(issue?.title ?? '');
    setDescVal(issue?.description ?? '');
    setEditingTitle(false);
    setDetachChildren(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?.id]);

  // Comments are posted with their own button and saved at once, so keep the draft in step with them
  const issueId = issue?.id;
  const issueComments = issue?.comments;
  useEffect(() => {
    if (issueId === undefined) return;
    setLocal(prev => (prev && prev.id === issueId ? { ...prev, comments: issueComments as Issue['comments'] } : prev));
  }, [issueComments, issueId]);

  return { local, setLocal, editingTitle, setEditingTitle, titleVal, setTitleVal, descVal, setDescVal, detachChildren, setDetachChildren };
}
