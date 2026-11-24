import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadAttachment, formatBytes, MAX_EMBED_BYTES, readAttachment, SOURCE_LABEL } from './attachments';

afterEach(() => vi.restoreAllMocks());

describe('turning a file into an attachment', () => {
  it('keeps a small file inside the ticket, with its name, size and kind, and a new id each time', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const a = await readAttachment(file);
    expect(a.embedded).toBe(true);
    expect(a.attachment).toMatchObject({ name: 'notes.txt', size: 5, type: 'text/plain' });
    expect(a.attachment.dataUrl).toBe('data:text/plain;base64,aGVsbG8=');
    expect(a.attachment.createdAt).toBeInstanceOf(Date);
    expect((await readAttachment(file)).attachment.id).not.toBe(a.attachment.id);
  });

  it('keeps a file of exactly the limit inside, and lists a bigger one by name only', async () => {
    const edge = await readAttachment(new File([new Uint8Array(MAX_EMBED_BYTES)], 'edge.bin'));
    expect(edge.embedded).toBe(true);
    const big = await readAttachment(new File([new Uint8Array(MAX_EMBED_BYTES + 1)], 'big.bin'));
    expect(big.embedded).toBe(false);
    expect(big.attachment.dataUrl).toBeUndefined();
    expect(big.attachment.size).toBe(MAX_EMBED_BYTES + 1);
  });

  it('names a pasted file that has no name', async () => {
    expect((await readAttachment(new File(['x'], ''))).attachment.name).toBe('pasted-file');
  });

  it('gives an error when the file cannot be read', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) { queueMicrotask(() => this.onerror?.(new ProgressEvent('error') as never)); });
    await expect(readAttachment(new File(['x'], 'a.txt'))).rejects.toBeDefined();
    expect(read).toHaveBeenCalled();
  });
});

describe('sizes and sources', () => {
  it('writes bytes, kilobytes and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5.25 * 1024 * 1024)).toBe('5.3 MB');
  });
  it('has a name for every place a file can come from', () => {
    expect(Object.keys(SOURCE_LABEL).sort()).toEqual(['drive', 'dropbox', 'file', 'link', 'onedrive']);
    expect(SOURCE_LABEL.file).toBe('this computer');
  });
});

describe('saving an attachment to the computer', () => {
  it('saves it under its name when it is kept in the ticket, and leaves nothing behind in the page', () => {
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });
    const ok = downloadAttachment({ id: '1', name: 'a.txt', size: 1, type: 'text/plain', createdAt: new Date(), dataUrl: 'data:text/plain;base64,eA==' });
    expect(ok).toBe(true);
    expect(clicked[0].download).toBe('a.txt');
    expect(clicked[0].href).toContain('data:text/plain');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
  it('says no when the file was too big to be kept, because there is nothing to save', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(downloadAttachment({ id: '1', name: 'big.bin', size: 9e9, type: '', createdAt: new Date() })).toBe(false);
    expect(click).not.toHaveBeenCalled();
  });
});
