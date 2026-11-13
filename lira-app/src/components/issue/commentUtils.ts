import { v4 as uuidv4 } from 'uuid';
import type { Attachment, Comment } from '../../types/issue';
import { currentUser } from '../../utils/currentUser';
import { descriptionToText } from '../../utils/richText';

/** A comment can be edited by the person who wrote it. */
export function isOwnComment(c: Comment): boolean {
  const me = currentUser();
  return [c.author, c.authorInitials].some(v => !!v && (v === me.initials || v === me.name));
}

/** A comment has something to post when it has text or a file. */
export const hasCommentContent = (html: string, attachments: Attachment[]) => !!descriptionToText(html).trim() || attachments.length > 0;

/** A comment that is being written and has not been saved yet. */
export interface CommentDraft { html: string; files: Attachment[] }
export const NO_COMMENT_DRAFT: CommentDraft = Object.freeze({ html: '', files: [] as Attachment[] });

/** The comment to save for what was written, by the person using Lira, now. */
export function newComment(draft: CommentDraft, now = new Date()): Comment {
  const me = currentUser();
  return { id: uuidv4(), author: me.initials, authorInitials: me.initials, content: draft.html, attachments: draft.files, createdAt: now };
}
