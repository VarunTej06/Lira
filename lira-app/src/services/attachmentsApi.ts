import { send, type AuthResult } from './authApi';

/**
 * Hosted edition: files on a ticket (api/src/attachments, ADR-0011). The file bytes go straight from the browser to Blob Storage
 * with an address the API hands out after checking access, so nothing here sends a file to the API or keeps one in the browser.
 */
export interface ServerAttachment { id: string; ticketId: number; name: string; size: number; type: string; createdAt: string }

interface UploadGrant { attachment: ServerAttachment; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }

const org = (orgId: string) => `/api/orgs/${encodeURIComponent(orgId)}`;
const NO_ANSWER = 'Could not reach the file storage. Check your connection and try again.';

export const listAttachments = (orgId: string, ticketId: number) => send<ServerAttachment[]>('GET', `${org(orgId)}/tickets/${ticketId}/attachments`);
export const deleteAttachment = (orgId: string, id: string) => send<void>('DELETE', `${org(orgId)}/attachments/${id}`);

/** A short-lived address that downloads the file. Ask for a new one each time; it stops working after a few minutes. */
export const downloadAddress = (orgId: string, id: string) => send<{ url: string }>('GET', `${org(orgId)}/attachments/${id}/download`);

/** The three steps: ask for an upload address, send the file there, tell the server it arrived. A failed upload leaves nothing listed. */
export async function uploadAttachment(orgId: string, ticketId: number, file: File): Promise<AuthResult<ServerAttachment>> {
  const asked = await send<UploadGrant>('POST', `${org(orgId)}/tickets/${ticketId}/attachments`, { name: file.name || 'pasted-file', size: file.size, type: file.type });
  if (!asked.ok) return asked;
  try {
    const put = await fetch(asked.data.upload.url, { method: 'PUT', headers: asked.data.upload.headers, body: file });
    if (!put.ok) return { ok: false, status: put.status, message: 'The file could not be stored. Try again.' };
  } catch {
    return { ok: false, status: 0, message: NO_ANSWER };
  }
  return send<ServerAttachment>('POST', `${org(orgId)}/attachments/${asked.data.attachment.id}/confirm`);
}
