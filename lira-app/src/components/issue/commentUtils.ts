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
