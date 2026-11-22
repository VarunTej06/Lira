import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { AzureBlobStore, attachmentDisposition } from './blob-store';
import { ALLOWED_TYPES, MAX_BYTES, requestUploadSchema } from './schemas';

const KEY = Buffer.from('a-test-key-that-is-not-real-0123456789').toString('base64');
const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('upload request schema', () => {
  const good = { name: 'plan.png', size: 1024, type: 'image/png' };
  it('accepts a normal file', () => { expect(requestUploadSchema.safeParse(good).success).toBe(true); });

  it('refuses kinds a browser could run as a page, and anything not on the list', () => {
    for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'application/x-msdownload', 'application/octet-stream', '']) {
      expect(requestUploadSchema.safeParse({ ...good, type }).success, type).toBe(false);
    }
    expect(ALLOWED_TYPES.some(t => /html|svg|javascript|xml$/.test(t))).toBe(false);
  });

  it('refuses an empty file, one over 25 MB, and a size that is not a whole number', () => {
    for (const size of [0, -1, MAX_BYTES + 1, 1.5, Number.NaN]) expect(requestUploadSchema.safeParse({ ...good, size }).success, String(size)).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, size: MAX_BYTES }).success).toBe(true);
  });

  it('refuses file names with slashes, control characters or more than 255 characters, and unknown fields', () => {
    for (const name of ['../etc/passwd', 'a/b.png', 'a\\b.png', 'a\u0000b.png', 'a\nb.png', '', 'x'.repeat(256)]) expect(requestUploadSchema.safeParse({ ...good, name }).success, JSON.stringify(name)).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, path: 'x' }).success).toBe(false);
    expect(requestUploadSchema.safeParse({ ...good, status: 'ready' }).success).toBe(false);
  });
});

describe('download header', () => {
  it('is always an attachment and encodes everything that could end or change the header', () => {
    const h = attachmentDisposition('a"b; c\r\nSet-Cookie: x=1 (1).png');
    expect(h.startsWith("attachment; filename*=UTF-8''")).toBe(true);
    expect(h).not.toMatch(/[\r\n"]/);
    expect(h.slice(h.indexOf("''") + 2)).not.toMatch(/[ ;'()*]/);
  });
});

describe('Azure signed links', () => {
  const store = new AzureBlobStore('liraspaces12345', KEY, 'attachments', () => NOW);

  it('lets an upload write one named file, over HTTPS only, for the time given and no longer', () => {
    const { url, expiresAt } = store.uploadUrl('org/12/abc', 600);
    const u = new URL(url);
    expect(u.origin).toBe('https://liraspaces12345.blob.core.windows.net');
    expect(u.pathname).toBe('/attachments/org/12/abc');
    expect(u.searchParams.get('sp')).toBe('cw');
    expect(u.searchParams.get('spr')).toBe('https');
    expect(u.searchParams.get('sr')).toBe('b');
    expect(u.searchParams.get('se')).toBe('2026-11-20T10:10:00Z');
    expect(u.searchParams.get('sig')).toBeTruthy();
    expect(expiresAt.toISOString()).toBe('2026-11-20T10:10:00.000Z');
  });

  it('lets a download only read, as a download, with the type chosen by the server', () => {
    const u = new URL(store.downloadUrl('org/12/abc', 300, 'plan.pdf', 'application/octet-stream').url);
    expect(u.searchParams.get('sp')).toBe('r');
    expect(u.searchParams.get('rscd')).toBe("attachment; filename*=UTF-8''plan.pdf");
    expect(u.searchParams.get('rsct')).toBe('application/octet-stream');
    expect(u.searchParams.get('se')).toBe('2026-11-20T10:05:00Z');
  });

  it('signs differently for a different file, and carries no account key in the address', () => {
    const a = store.uploadUrl('org/12/a', 600).url; const b = store.uploadUrl('org/12/b', 600).url;
    expect(new URL(a).searchParams.get('sig')).not.toBe(new URL(b).searchParams.get('sig'));
    expect(a).not.toContain(KEY);
  });
});

describe('storage settings', () => {
  const base = { DATABASE_URL: 'postgres://x', ALLOWED_ORIGINS: 'https://a.example' };
  it('has no storage when none is set, and the default container when it is', () => {
    expect(loadConfig(base).storage).toBeUndefined();
    expect(loadConfig({ ...base, STORAGE_ACCOUNT: 'liraspaces12345', STORAGE_KEY: KEY }).storage).toEqual({ account: 'liraspaces12345', key: KEY, container: 'attachments' });
  });
  it('refuses an account without a key, a key without an account, and a bad account name', () => {
    expect(() => loadConfig({ ...base, STORAGE_ACCOUNT: 'liraspaces12345' })).toThrow(/together/);
    expect(() => loadConfig({ ...base, STORAGE_KEY: KEY })).toThrow(/together/);
    expect(() => loadConfig({ ...base, STORAGE_ACCOUNT: 'Bad_Name', STORAGE_KEY: KEY })).toThrow(/STORAGE_ACCOUNT/);
  });
});
