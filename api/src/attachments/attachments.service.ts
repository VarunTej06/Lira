import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DbService, type Queryable } from '../db/db.service';
import { MetricsService } from '../observability/metrics.service';
import { BLOB_STORE, type BlobStore } from './blob-store';
import { IMAGE_TYPES, type RequestUpload } from './schemas';

export interface AttachmentOut { id: string; ticketId: number; name: string; size: number; type: string; createdAt: string }
export interface UploadOut { attachment: AttachmentOut; upload: { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string } }

interface Row { id: string; ticket_id: string; name: string; size: string; content_type: string; blob_path: string; created_at: Date }

const COLUMNS = 'id, ticket_id, name, size, content_type, blob_path, created_at';
const out = (r: Row): AttachmentOut => ({ id: r.id, ticketId: Number(r.ticket_id), name: r.name, size: Number(r.size), type: r.content_type, createdAt: r.created_at.toISOString() });

const UPLOAD_SECONDS = 600;
const DOWNLOAD_SECONDS = 300;
/** A ticket holds at most this many files, counting ones still being uploaded, so a loop cannot fill the storage. */
const MAX_PER_TICKET = 50;

@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService,
    @Inject(MetricsService) private readonly metrics: MetricsService, @Inject(BLOB_STORE) private readonly store: BlobStore | null,
  ) {}

  private storage(): BlobStore {
    if (!this.store) throw new ServiceUnavailableException({ code: 'unavailable', message: 'File storage is not set up on this server.' });
    return this.store;
  }

  /** Hands out the upload address. The row stays "pending" until the file is confirmed, and the path comes from ids, never from the name. */
  async request(orgId: string, ticketId: number, actor: string, input: RequestUpload): Promise<UploadOut> {
    const store = this.storage();
    const row = await this.db.transaction(async tx => {
      if ((await tx.query('SELECT 1 FROM tickets WHERE org_id = $1 AND id = $2 FOR SHARE', [orgId, ticketId])).rowCount === 0) throw new NotFoundException('Not found.');
      const count = await tx.query<{ n: string }>('SELECT count(*) AS n FROM attachments WHERE org_id = $1 AND ticket_id = $2', [orgId, ticketId]);
      if (Number(count.rows[0].n) >= MAX_PER_TICKET) throw new ConflictException({ code: 'too_many_files', message: `A ticket can hold at most ${MAX_PER_TICKET} files.` });
      const made = await tx.query<Row>(
        `INSERT INTO attachments (org_id, ticket_id, name, size, content_type, blob_path, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNS}`,
        [orgId, ticketId, input.name, input.size, input.type, `${orgId}/${ticketId}/${randomUUID()}`, actor]);
      return made.rows[0];
    });
    const signed = store.uploadUrl(row.blob_path, UPLOAD_SECONDS);
    return { attachment: out(row), upload: { url: signed.url, method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': input.type }, expiresAt: signed.expiresAt.toISOString() } };
  }

  /** Marks the file ready once the server has seen it in storage with the size that was declared. Anything else is removed. */
  async confirm(orgId: string, id: string, actor: string, ip: string): Promise<AttachmentOut> {
    const store = this.storage();
    const found = await this.db.query<Row & { status: string }>(`SELECT ${COLUMNS}, status FROM attachments WHERE org_id = $1 AND id = $2`, [orgId, id]);
    const row = found.rows[0];
    if (!row) throw new NotFoundException('Not found.');
    if (row.status === 'ready') return out(row);
    const stored = await store.size(row.blob_path);
    if (stored === null) throw new ConflictException({ code: 'not_uploaded', message: 'The file has not arrived yet. Upload it, then confirm.' });
    if (stored !== Number(row.size)) {
      await store.remove(row.blob_path);
      await this.db.query('DELETE FROM attachments WHERE org_id = $1 AND id = $2', [orgId, id]);
      throw new ConflictException({ code: 'size_mismatch', message: 'The uploaded file is not the size that was declared, so it was removed.' });
    }
    await this.db.transaction(async tx => {
      await tx.query("UPDATE attachments SET status = 'ready' WHERE org_id = $1 AND id = $2", [orgId, id]);
      await this.audit.record({ actor, orgId, action: 'attachment.add', outcome: 'ok', sourceIp: ip, detail: { attachmentId: id, ticketId: Number(row.ticket_id), size: Number(row.size), type: row.content_type } }, tx);
    });
    this.metrics.inc('attachment_writes_total', { action: 'add' });
    return out(row);
  }

  /** The ticket an attachment belongs to, for deciding access. */
  async ticketOf(orgId: string, id: string): Promise<number> {
    const rows = await this.db.query<{ ticket_id: string }>('SELECT ticket_id FROM attachments WHERE org_id = $1 AND id = $2', [orgId, id]);
    if (!rows.rows[0]) throw new NotFoundException('Not found.');
    return Number(rows.rows[0].ticket_id);
  }

  async list(orgId: string, ticketId: number): Promise<AttachmentOut[]> {
    if ((await this.db.query('SELECT 1 FROM tickets WHERE org_id = $1 AND id = $2', [orgId, ticketId])).rowCount === 0) throw new NotFoundException('Not found.');
    const rows = await this.db.query<Row>(`SELECT ${COLUMNS} FROM attachments WHERE org_id = $1 AND ticket_id = $2 AND status = 'ready' ORDER BY created_at`, [orgId, ticketId]);
    return rows.rows.map(out);
  }

  /** A short-lived link. It always downloads: only the picture types are sent with their own type, so nothing runs as a page. */
  async download(orgId: string, id: string): Promise<{ url: string; expiresAt: string }> {
    const store = this.storage();
    const found = await this.db.query<Row>(`SELECT ${COLUMNS} FROM attachments WHERE org_id = $1 AND id = $2 AND status = 'ready'`, [orgId, id]);
    const row = found.rows[0];
    if (!row) throw new NotFoundException('Not found.');
    const signed = store.downloadUrl(row.blob_path, DOWNLOAD_SECONDS, row.name, IMAGE_TYPES.includes(row.content_type) ? row.content_type : 'application/octet-stream');
    this.metrics.inc('attachment_reads_total');
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  async remove(orgId: string, id: string, actor: string, ip: string): Promise<void> {
    const store = this.storage();
    const path = await this.db.transaction(async tx => {
      const gone = await tx.query<Row>('DELETE FROM attachments WHERE org_id = $1 AND id = $2 RETURNING blob_path, ticket_id', [orgId, id]);
      if (!gone.rows[0]) throw new NotFoundException('Not found.');
      await this.audit.record({ actor, orgId, action: 'attachment.delete', outcome: 'ok', sourceIp: ip, detail: { attachmentId: id, ticketId: Number(gone.rows[0].ticket_id) } }, tx);
      return gone.rows[0].blob_path;
    });
    await store.remove(path);
    this.metrics.inc('attachment_writes_total', { action: 'delete' });
  }

  /** The stored paths of the files of one ticket, or of every ticket in a space. Read before the rows are deleted by the cascade. */
  async pathsOf(at: Queryable, orgId: string, scope: { ticketId: number } | { spaceId: number }): Promise<string[]> {
    const rows = 'ticketId' in scope
      ? await at.query<{ blob_path: string }>('SELECT blob_path FROM attachments WHERE org_id = $1 AND ticket_id = $2', [orgId, scope.ticketId])
      : await at.query<{ blob_path: string }>('SELECT a.blob_path FROM attachments a JOIN tickets t ON t.id = a.ticket_id WHERE a.org_id = $1 AND t.space_id = $2', [orgId, scope.spaceId]);
    return rows.rows.map(r => r.blob_path);
  }

  /** Removes stored files after their rows are gone. A file that cannot be removed is only logged by the store; the row is already deleted. */
  async removeFiles(paths: string[]): Promise<void> {
    if (!this.store) return;
    await Promise.allSettled(paths.map(path => this.store!.remove(path)));
  }
}
