import { BlobSASPermissions, BlobServiceClient, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters } from '@azure/storage-blob';

/** A short-lived address the browser uses directly, so file bytes never pass through the API or the database. */
export interface SignedUrl { url: string; expiresAt: Date }

/** What the API needs from file storage. The real one is Azure Blob Storage; tests use a copy in memory. */
export interface BlobStore {
  /** Address the browser sends the file to (an HTTP PUT). It allows writing this one path and nothing else. */
  uploadUrl(path: string, ttlSeconds: number): SignedUrl;
  /** Address the browser reads the file from. `filename` makes the browser download it instead of showing it as a page. */
  downloadUrl(path: string, ttlSeconds: number, filename: string, contentType: string): SignedUrl;
  /** The size of the stored file, or null when nothing was uploaded. */
  size(path: string): Promise<number | null>;
  remove(path: string): Promise<void>;
}

export const BLOB_STORE = Symbol('BLOB_STORE');

/** The value for Content-Disposition: always an attachment, with the name encoded so it cannot end the header early. */
export const attachmentDisposition = (filename: string): string => `attachment; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;

export class AzureBlobStore implements BlobStore {
  private readonly credential: StorageSharedKeyCredential;
  private readonly service: BlobServiceClient;

  constructor(private readonly account: string, key: string, private readonly container: string, private readonly now: () => Date = () => new Date()) {
    this.credential = new StorageSharedKeyCredential(account, key);
    this.service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, this.credential);
  }

  private sign(path: string, permissions: string, ttlSeconds: number, extra: { contentDisposition?: string; contentType?: string } = {}): SignedUrl {
    const startsOn = new Date(this.now().getTime() - 60_000); // a minute back, so a small clock difference does not refuse a fresh link
    const expiresAt = new Date(this.now().getTime() + ttlSeconds * 1000);
    const token = generateBlobSASQueryParameters({
      containerName: this.container, blobName: path, permissions: BlobSASPermissions.parse(permissions), startsOn, expiresOn: expiresAt, protocol: SASProtocol.Https, ...extra,
    }, this.credential).toString();
    return { url: `https://${this.account}.blob.core.windows.net/${this.container}/${path.split('/').map(encodeURIComponent).join('/')}?${token}`, expiresAt };
  }

  uploadUrl(path: string, ttlSeconds: number): SignedUrl { return this.sign(path, 'cw', ttlSeconds); }

  downloadUrl(path: string, ttlSeconds: number, filename: string, contentType: string): SignedUrl {
    return this.sign(path, 'r', ttlSeconds, { contentDisposition: attachmentDisposition(filename), contentType });
  }

  async size(path: string): Promise<number | null> {
    try { return (await this.service.getContainerClient(this.container).getBlobClient(path).getProperties()).contentLength ?? null; }
    catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
  }

  async remove(path: string): Promise<void> {
    await this.service.getContainerClient(this.container).getBlobClient(path).deleteIfExists();
  }
}
