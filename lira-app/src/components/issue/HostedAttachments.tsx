import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Plus, Upload, X } from 'lucide-react';
import { deleteAttachment, downloadAddress, listAttachments, uploadAttachment, type ServerAttachment } from '../../services/attachmentsApi';
import { formatBytes } from '../../utils/attachments';
import { activeOrg } from '../../utils/hostedOrg';
import { Skeleton } from '../common/Skeleton';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; files: ServerAttachment[] };

/**
 * Hosted edition: the files of one ticket, kept in Blob Storage and listed from the server. It looks like the local list, but a
 * file is sent to storage, never kept inside the ticket or the browser. Links to Drive, OneDrive or Dropbox are not offered here yet.
 */
export function HostedAttachments({ ticketId }: { ticketId: number }) {
  const org = activeOrg();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const [reloads, setReloads] = useState(0);
  const refresh = () => setReloads(n => n + 1);

  useEffect(() => {
    if (!org) return;
    let current = true;
    void listAttachments(org, ticketId).then(r => { if (current) setLoad(r.ok ? { state: 'ready', files: r.data } : { state: 'error', message: r.message }); });
    return () => { current = false; };
  }, [org, ticketId, reloads]);

  const add = async (files: FileList | null) => {
    if (!org || !files?.length) return;
    setProblem('');
    for (const file of Array.from(files)) {
      setBusy(n => n + 1);
      const r = await uploadAttachment(org, ticketId, file);
      setBusy(n => n - 1);
      if (!r.ok) setProblem(`${file.name}: ${r.fields?.type ?? r.fields?.size ?? r.fields?.name ?? r.message}`);
    }
    refresh();
  };

  const download = async (file: ServerAttachment) => {
    const r = await downloadAddress(org!, file.id);
    if (r.ok) window.location.assign(r.data.url); else setProblem(r.message);
  };

  const remove = async (file: ServerAttachment) => {
    const r = await deleteAttachment(org!, file.id);
    if (r.ok) refresh(); else setProblem(r.message);
  };

  return (
    <div className="space-y-3" data-testid="hosted-attachments">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-lira-text">Attachments</h3>
        <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-lira-text border border-lira-border rounded-md hover:bg-gray-50 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Add attachment
        </button>
        <input ref={input} type="file" multiple hidden aria-label="Choose files" onChange={e => { void add(e.target.files); e.target.value = ''; }} />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); void add(e.dataTransfer.files); }}
        onClick={() => input.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${dragging ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border hover:border-lira-blue hover:bg-gray-50'}`}
      >
        <Upload className="w-5 h-5 mx-auto mb-2 text-lira-muted" />
        <p className="text-xs text-lira-muted">Drop files here or <span className="text-lira-blue font-medium">browse</span>. Up to 25 MB each.</p>
      </div>

      {busy > 0 && <p role="status" className="text-xs text-lira-muted">Uploading {busy} {busy === 1 ? 'file' : 'files'}</p>}
      {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}

      {!org && <p role="alert" className="text-xs text-red-600">You are not signed in to an organisation.</p>}
      {org && load.state === 'loading' && <div role="status" aria-label="Loading files" className="grid grid-cols-2 gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
      {org && load.state === 'error' && (
        <p role="alert" className="text-xs text-red-600">
          {load.message} <button type="button" onClick={() => { setLoad({ state: 'loading' }); refresh(); }} className="underline">Try again</button>
        </p>
      )}
      {org && load.state === 'ready' && load.files.length === 0 && <p className="text-xs text-lira-muted">No files yet.</p>}
      {org && load.state === 'ready' && load.files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {load.files.map(file => (
            <li key={file.id} className="group flex items-center gap-2 p-2 border border-lira-border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-lira-blue-light rounded flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-lira-blue" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-lira-text truncate">{file.name}</p>
                <p className="text-3xs text-lira-muted">{formatBytes(file.size)}</p>
              </div>
              <button type="button" onClick={() => void download(file)} aria-label={`Download ${file.name}`} className="p-1 rounded hover:bg-gray-200 text-lira-muted"><Download className="w-3 h-3" /></button>
              <button type="button" onClick={() => void remove(file)} aria-label={`Remove ${file.name}`} className="p-1 rounded hover:bg-red-50 text-lira-muted hover:text-red-500"><X className="w-3 h-3" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
