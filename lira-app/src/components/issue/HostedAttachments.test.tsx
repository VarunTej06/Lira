import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { setActiveOrg } from '../../utils/hostedOrg';
import { HostedAttachments } from './HostedAttachments';

const api = vi.hoisted(() => ({ listAttachments: vi.fn(), uploadAttachment: vi.fn(), downloadAddress: vi.fn(), deleteAttachment: vi.fn() }));
vi.mock('../../services/attachmentsApi', () => api);

const ok = <T,>(data: T) => ({ ok: true as const, data });
const refused = (message: string, fields?: Record<string, string>) => ({ ok: false as const, status: 400, message, fields });
const file = { id: 'a1', ticketId: 4, name: 'plan.png', size: 2048, type: 'image/png', createdAt: '2026-11-20T10:00:00Z' };

beforeEach(() => { Object.values(api).forEach(f => f.mockReset()); setActiveOrg('org-1'); api.listAttachments.mockResolvedValue(ok([file])); });
afterEach(() => { cleanup(); setActiveOrg(null); });

const picker = () => q<HTMLInputElement>('input[type="file"]')!;
async function choose(...files: File[]) {
  Object.defineProperty(picker(), 'files', { configurable: true, value: files });
  await act(async () => { picker().dispatchEvent(new Event('change', { bubbles: true })); });
  await settle(20);
}

describe('files on a ticket in the hosted edition', () => {
  it('shows a loading state, then the files from the server with their size', async () => {
    api.listAttachments.mockReturnValue(new Promise(() => undefined));
    mount(<HostedAttachments ticketId={4} />);
    expect(q('[aria-label="Loading files"]')).not.toBeNull();
    cleanup();
    api.listAttachments.mockResolvedValue(ok([file]));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    expect(api.listAttachments).toHaveBeenLastCalledWith('org-1', 4);
    expect(q('li')!.textContent).toContain('plan.png');
    expect(q('li')!.textContent).toContain('2.0 KB');
  });

  it('says so when there are no files, and when the list cannot be loaded, with a way to try again', async () => {
    api.listAttachments.mockResolvedValue(ok([]));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    expect(q('[data-testid="hosted-attachments"]')!.textContent).toContain('No files yet.');
    cleanup();
    api.listAttachments.mockResolvedValueOnce({ ok: false, status: 0, message: 'Could not reach the server.' }).mockResolvedValue(ok([file]));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('Could not reach the server.');
    await click(byText('button', 'Try again'));
    await settle(30);
    expect(q('li')).not.toBeNull();
  });

  it('uploads each chosen file to the server, then lists again', async () => {
    api.uploadAttachment.mockResolvedValue(ok(file));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    const a = new File(['a'], 'a.png', { type: 'image/png' }); const b = new File(['b'], 'b.pdf', { type: 'application/pdf' });
    await choose(a, b);
    expect(api.uploadAttachment.mock.calls.map(c => [c[0], c[1], c[2].name])).toEqual([['org-1', 4, 'a.png'], ['org-1', 4, 'b.pdf']]);
    expect(api.listAttachments).toHaveBeenCalledTimes(2);
  });

  it('shows which file was refused and why, and keeps going with the rest', async () => {
    api.uploadAttachment.mockResolvedValueOnce(refused('Some fields need attention.', { type: 'This kind of file is not allowed.' })).mockResolvedValue(ok(file));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    await choose(new File(['x'], 'page.html', { type: 'text/html' }), new File(['y'], 'ok.png', { type: 'image/png' }));
    expect(q('[role="alert"]')!.textContent).toBe('page.html: This kind of file is not allowed.');
    expect(api.uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('downloads through a fresh short-lived address', async () => {
    api.downloadAddress.mockResolvedValue(ok({ url: 'https://store.example/file?sig=1' }));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    await click(q('[aria-label="Download plan.png"]')!);
    expect(api.downloadAddress).toHaveBeenCalledWith('org-1', 'a1');
    expect(assign).toHaveBeenCalledWith('https://store.example/file?sig=1');
    vi.unstubAllGlobals();
  });

  it('removes a file on the server and lists again', async () => {
    api.deleteAttachment.mockResolvedValue(ok(undefined));
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    api.listAttachments.mockResolvedValue(ok([]));
    await click(q('[aria-label="Remove plan.png"]')!);
    await settle(30);
    expect(api.deleteAttachment).toHaveBeenCalledWith('org-1', 'a1');
    expect(qa('li')).toHaveLength(0);
  });

  it('keeps no file in the ticket or the browser: the list comes only from the server', async () => {
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    expect(localStorage.length).toBe(0);
    expect(q('img')).toBeNull();
  });

  it('asks for a sign-in instead of calling the server when there is no organisation', async () => {
    setActiveOrg(null);
    mount(<HostedAttachments ticketId={4} />);
    await settle(30);
    expect(q('[role="alert"]')!.textContent).toContain('not signed in');
    expect(api.listAttachments).not.toHaveBeenCalled();
  });
});
