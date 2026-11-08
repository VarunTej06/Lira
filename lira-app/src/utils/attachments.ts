import { v4 as uuidv4 } from 'uuid';
import type { Attachment, AttachmentSource } from '../types/issue';

/** Files are kept inside the ticket (as a data URL) up to this size. Bigger files are listed by name only. */
export const MAX_EMBED_BYTES = 2 * 1024 * 1024;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export interface ReadAttachment { attachment: Attachment; embedded: boolean }

/** Turns a file the person picked, dropped or pasted into an attachment of the ticket. */
export async function readAttachment(file: File): Promise<ReadAttachment> {
  const attachment: Attachment = { id: uuidv4(), name: file.name || 'pasted-file', size: file.size, type: file.type, createdAt: new Date() };
  const embedded = file.size <= MAX_EMBED_BYTES;
  if (embedded) attachment.dataUrl = await readAsDataUrl(file);
  return { attachment, embedded };
}

export const SOURCE_LABEL: Record<AttachmentSource, string> = {
  file: 'this computer', drive: 'Google Drive', onedrive: 'OneDrive', dropbox: 'Dropbox', link: 'the web page',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Saves an attachment to the computer. */
export function downloadAttachment(att: Attachment): boolean {
  if (!att.dataUrl) return false;
  const a = document.createElement('a');
  a.href = att.dataUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
