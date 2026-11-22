import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteAttachment, downloadAddress, listAttachments, uploadAttachment } from './attachmentsApi';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const grant = { attachment: { id: 'a1', ticketId: 4, name: 'plan.png', size: 3, type: 'image/png', createdAt: '2026-11-20T10:00:00Z' }, upload: { url: 'https://store.blob.core.windows.net/attachments/o/4/x?sig=1', method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'image/png' } } };
const file = new File(['abc'], 'plan.png', { type: 'image/png' });

type Call = [string, RequestInit | undefined];
const stub = (reply: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const f = vi.fn(async (url: string, init?: RequestInit) => reply(url, init));
  vi.stubGlobal('fetch', f);
  return f as unknown as { mock: { calls: Call[] } };
};
afterEach(() => vi.unstubAllGlobals());

describe('uploading a file', () => {
  it('asks the API, sends the file to the address it gave with the headers it gave, then confirms', async () => {
    const f = stub(url => (url.endsWith('/attachments') ? json(201, grant) : url.startsWith('https://store') ? new Response(null, { status: 201 }) : json(200, grant.attachment)));
    const r = await uploadAttachment('org 1', 4, file);
    expect(r).toEqual({ ok: true, data: grant.attachment });
    const [ask, put, confirm] = f.mock.calls;
    expect(ask[0]).toBe('/api/orgs/org%201/tickets/4/attachments');
    expect(JSON.parse(ask[1]!.body as string)).toEqual({ name: 'plan.png', size: 3, type: 'image/png' });
    expect(put[0]).toBe(grant.upload.url);
    expect(put[1]).toMatchObject({ method: 'PUT', headers: grant.upload.headers, body: file });
    expect(put[1]!.credentials).toBeUndefined(); // the storage address gets no session cookie
    expect(confirm[0]).toBe('/api/orgs/org%201/attachments/a1/confirm');
  });

  it('stops at the first refusal and never contacts storage when the API refuses the file', async () => {
    const f = stub(() => json(400, { error: { message: 'Some fields need attention.', fields: { type: 'This kind of file is not allowed.' } } }));
    const r = await uploadAttachment('o', 4, file);
    expect(r).toMatchObject({ ok: false, status: 400, fields: { type: 'This kind of file is not allowed.' } });
    expect(f.mock.calls).toHaveLength(1);
  });

  it('does not confirm when storage refuses the file, and says so', async () => {
    const f = stub(url => (url.endsWith('/attachments') ? json(201, grant) : new Response('denied', { status: 403 })));
    expect(await uploadAttachment('o', 4, file)).toMatchObject({ ok: false, status: 403, message: expect.stringMatching(/could not be stored/) });
    expect(f.mock.calls).toHaveLength(2);
  });

  it('says it could not reach storage when the upload gets no answer', async () => {
    stub(url => { if (url.endsWith('/attachments')) return json(201, grant); throw new TypeError('offline'); });
    expect(await uploadAttachment('o', 4, file)).toMatchObject({ ok: false, status: 0, message: expect.stringMatching(/file storage/) });
  });

  it('names a file that has no name', async () => {
    const f = stub(() => json(400, { error: { message: 'x' } }));
    await uploadAttachment('o', 4, new File(['a'], '', { type: 'text/plain' }));
    expect(JSON.parse(f.mock.calls[0][1]!.body as string).name).toBe('pasted-file');
  });
});

describe('the other calls', () => {
  it('list, download address and delete go to the organisation\'s own routes with the session cookie', async () => {
    const f = stub(() => json(200, []));
    await listAttachments('o', 4);
    await downloadAddress('o', 'a1');
    await deleteAttachment('o', 'a1');
    expect(f.mock.calls.map(c => [c[0], c[1]!.method])).toEqual([['/api/orgs/o/tickets/4/attachments', 'GET'], ['/api/orgs/o/attachments/a1/download', 'GET'], ['/api/orgs/o/attachments/a1', 'DELETE']]);
    expect(f.mock.calls.every(c => c[1]!.credentials === 'same-origin')).toBe(true);
  });
});
