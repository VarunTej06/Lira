import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Attachment, Comment, Issue } from '../../../types/issue';
import { updateIssue } from '../../../hooks/useIssues';
import { safeArr } from './issueOptions';

/** Comments are saved at once, like posting one; they are not part of the draft. */
export function useCommentActions(local: Issue | null, setLocal: Dispatch<SetStateAction<Issue | null>>) {
  const handleAddComment = useCallback(async (comment: Comment) => {
    if (!local) return;
    if (!local.id) return;
    const newComments = [...safeArr(local.comments), comment];
    setLocal(prev => (prev ? { ...prev, comments: newComments } : prev));
    await updateIssue(local.id, { comments: newComments });
  }, [local, setLocal]);

  /** Comments are saved at once, like posting one. Only the author's own comment can be changed. */
  const handleEditComment = useCallback(async (id: string, content: string, attachments: Attachment[]) => {
    if (!local?.id) return;
    const next = safeArr(local.comments).map(c => (c.id === id ? { ...c, content, attachments, updatedAt: new Date() } : c));
    setLocal(prev => (prev ? { ...prev, comments: next } : prev));
    await updateIssue(local.id, { comments: next });
  }, [local, setLocal]);
  return { handleAddComment, handleEditComment };
}
