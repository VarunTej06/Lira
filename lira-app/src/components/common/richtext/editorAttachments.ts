import type { Editor } from '@tiptap/react';
import type { Attachment } from '../../../types/issue';

/**
 * Puts one attachment into the text at the cursor: a link for a web address, a picture for an image, otherwise a link that
 * downloads the stored file. Returns true when the file itself was too big to be stored (only its name is kept).
 */
export function insertAttachment(editor: Editor, attachment: Attachment): boolean {
  if (attachment.url) {
    editor.chain().focus().insertContent([
      { type: 'text', text: attachment.name, marks: [{ type: 'link', attrs: { href: attachment.url } }] },
      { type: 'text', text: ' ' },
    ]).run();
    return false;
  }
  if (attachment.type.startsWith('image/') && attachment.dataUrl) {
    editor.chain().focus().insertContent({ type: 'image', attrs: { src: attachment.dataUrl, alt: attachment.name, attachmentId: attachment.id } }).run();
    return false;
  }
  editor.chain().focus().insertContent([
    { type: 'text', text: attachment.name, marks: [{ type: 'link', attrs: { href: `#attachment-${attachment.id}` } }] },
    { type: 'text', text: ' ' },
  ]).run();
  return !attachment.dataUrl;
}

/** A pasted screenshot is always called "image.png": give each one its own name from the time. */
export function screenshotName(f: File): File {
  return /^image\.(png|jpe?g|gif|webp)$/i.test(f.name) ? new File([f], `screenshot-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.${f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'}`, { type: f.type }) : f;
}
