import type { BlobStore, SignedUrl } from '../attachments/blob-store';

/** File storage in memory, for tests. `put` stands in for the browser sending the file to the upload address. */
export class MemoryBlobStore implements BlobStore {
  readonly files = new Map<string, number>();
  readonly issued: { kind: 'upload' | 'download'; path: string; ttlSeconds: number; filename?: string; contentType?: string }[] = [];

  uploadUrl(path: string, ttlSeconds: number): SignedUrl {
    this.issued.push({ kind: 'upload', path, ttlSeconds });
    return { url: `memory://upload/${path}`, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  downloadUrl(path: string, ttlSeconds: number, filename: string, contentType: string): SignedUrl {
    this.issued.push({ kind: 'download', path, ttlSeconds, filename, contentType });
    return { url: `memory://download/${path}`, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  put(path: string, bytes: number): void { this.files.set(path, bytes); }
  async size(path: string): Promise<number | null> { return this.files.get(path) ?? null; }
  async remove(path: string): Promise<void> { this.files.delete(path); }
}
