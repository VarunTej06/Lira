import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { Monitor, HardDrive, Cloud, Package, Link2, X, UploadCloud, FileText, ExternalLink, Check } from 'lucide-react';
import type { Attachment, AttachmentSource } from '../../types/issue';
import { readAttachment, formatBytes, MAX_EMBED_BYTES, SOURCE_LABEL } from '../../utils/attachments';
import { AnimatePresence, motion } from '../common/motionPresets';
import { dialogBackdrop, dialogPanel } from '../common/motionPresets';
import { useResetWhen } from '../../hooks/useResetWhen';

type SourceId = 'computer' | Exclude<AttachmentSource, 'file'>;

interface SourceDef { id: SourceId; label: string; hint: string; icon: React.ReactNode; tile: string }

const SOURCES: SourceDef[] = [
  { id: 'computer', label: 'My computer', hint: 'Upload from this device', icon: <Monitor className="w-4 h-4" />, tile: 'bg-slate-100 text-slate-700' },
  { id: 'drive', label: 'Google Drive', hint: 'Add a share link', icon: <HardDrive className="w-4 h-4" />, tile: 'bg-emerald-100 text-emerald-700' },
  { id: 'onedrive', label: 'OneDrive', hint: 'Add a share link', icon: <Cloud className="w-4 h-4" />, tile: 'bg-sky-100 text-sky-700' },
  { id: 'dropbox', label: 'Dropbox', hint: 'Add a share link', icon: <Package className="w-4 h-4" />, tile: 'bg-indigo-100 text-indigo-700' },
  { id: 'link', label: 'Web link', hint: 'Any page or file online', icon: <Link2 className="w-4 h-4" />, tile: 'bg-amber-100 text-amber-700' },
];

const HOW_TO: Record<'drive' | 'onedrive' | 'dropbox', string> = {
  drive: 'In Google Drive, right-click the file, choose Share, then Copy link. Paste it below.',
  onedrive: 'In OneDrive, select the file, choose Share, then Copy link. Paste it below.',
  dropbox: 'In Dropbox, hover over the file, choose Share, then Copy link. Paste it below.',
};

function cleanUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch { return null; }
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the files and links the person chose. */
  onAdd: (items: Attachment[]) => void;
}

/** The "add attachment" window: choose where the file is, pick it, review it, attach it. */
export const AttachPicker: React.FC<Props> = ({ open, onClose, onAdd }) => {
  const [source, setSource] = useState<SourceId>('computer');
  const [staged, setStaged] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useResetWhen([open], () => {
    if (!open) return;
    setSource('computer'); setStaged([]); setLinkUrl(''); setLinkName(''); setBusy(false); setDragging(false);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const stage = useCallback((list: FileList | File[] | null) => {
    if (!list) return;
    setStaged(prev => [...prev, ...Array.from(list)]);
  }, []);

  const url = cleanUrl(linkUrl);
  const isLinkSource = source !== 'computer';
  const canAttach = isLinkSource ? !!url : staged.length > 0;

  const attach = async () => {
    if (!canAttach || busy) return;
    setBusy(true);
    try {
      if (isLinkSource && url) {
        const host = new URL(url).hostname.replace(/^www\./, '');
        onAdd([{ id: uuidv4(), name: linkName.trim() || host, size: 0, type: 'link', url, source: source as AttachmentSource, createdAt: new Date() }]);
      } else {
        const items: Attachment[] = [];
        for (const f of staged) items.push((await readAttachment(f)).attachment);
        onAdd(items);
      }
      onClose();
    } finally { setBusy(false); }
  };

  const active = SOURCES.find(s => s.id === source)!;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="attach-picker"
          {...dialogBackdrop}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            {...dialogPanel}
            role="dialog" aria-modal="true" aria-label="Add attachment" data-testid="attach-picker"
            className="bg-white rounded-xl shadow-2xl border border-lira-border w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-lira-border">
              <div>
                <h2 className="text-base font-bold text-lira-text">Add attachment</h2>
                <p className="text-xs text-lira-muted mt-0.5">Choose where the file is</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-lira-muted cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex flex-col sm:flex-row min-h-0 flex-1">
              <nav className="sm:w-52 flex-shrink-0 flex sm:flex-col gap-1 p-3 sm:border-r border-b sm:border-b-0 border-lira-border overflow-x-auto bg-gray-50/60" aria-label="Sources">
                {SOURCES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSource(s.id)}
                    aria-pressed={source === s.id}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer flex-shrink-0 ${source === s.id ? 'bg-white shadow-xs ring-1 ring-lira-border' : 'hover:bg-white/70'}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.tile}`}>{s.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-lira-text whitespace-nowrap">{s.label}</span>
                      <span className="hidden sm:block text-2xs text-lira-muted truncate">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </nav>

              <div className="flex-1 min-w-0 p-5 overflow-y-auto">
                {source === 'computer' ? (
                  <div className="space-y-4">
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => { e.preventDefault(); setDragging(false); stage(e.dataTransfer.files); }}
                      className={`rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors ${dragging ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-gray-50/60'}`}
                    >
                      <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-white shadow-xs ring-1 ring-lira-border flex items-center justify-center text-lira-blue"><UploadCloud className="w-6 h-6" /></span>
                      <p className="text-sm font-medium text-lira-text">Drag files here</p>
                      <p className="text-xs text-lira-muted mt-1">or</p>
                      <button onClick={() => fileInput.current?.click()} className="mt-2 px-4 py-2 text-sm font-semibold text-white bg-lira-blue hover:bg-lira-blue-hover rounded-lg shadow-xs cursor-pointer">Choose files</button>
                      <input ref={fileInput} type="file" multiple className="hidden" data-testid="attach-file-input" onChange={e => { stage(e.target.files); e.target.value = ''; }} />
                      <p className="text-2xs text-lira-muted mt-4">Files up to {formatBytes(MAX_EMBED_BYTES)} are stored in Lira. Larger files are listed by name only.</p>
                    </div>

                    {staged.length > 0 && (
                      <ul className="space-y-1.5" aria-label="Files to attach">
                        {staged.map((f, i) => (
                          <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 border border-lira-border rounded-lg">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-lira-blue flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-lira-text truncate">{f.name}</span>
                              <span className="block text-2xs text-lira-muted">{formatBytes(f.size)}{f.size > MAX_EMBED_BYTES ? ' - too large to store, name only' : ''}</span>
                            </span>
                            <button onClick={() => setStaged(p => p.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="p-1 rounded hover:bg-red-50 text-lira-muted hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active.tile}`}>{active.icon}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-lira-text">{active.label}</h3>
                        <p className="text-xs text-lira-muted mt-0.5 leading-relaxed">
                          {source === 'link' ? 'Paste the address of any page or file.' : HOW_TO[source as keyof typeof HOW_TO]}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="attach-url" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Link</label>
                      <input
                        id="attach-url" autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void attach(); } }}
                        placeholder="https://" inputMode="url"
                        className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text"
                      />
                      {linkUrl.trim() && !url && <p className="text-xs text-red-600 mt-1.5">That is not a web address Lira can open.</p>}
                    </div>
                    <div>
                      <label htmlFor="attach-name" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">Name <span className="normal-case font-normal">(optional)</span></label>
                      <input
                        id="attach-name" value={linkName} onChange={e => setLinkName(e.target.value)}
                        placeholder="Shown on the ticket"
                        className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text"
                      />
                    </div>
                    {url && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Check className="w-3.5 h-3.5" /> Opens {SOURCE_LABEL[source as AttachmentSource]} <ExternalLink className="w-3 h-3" /></p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-lira-border bg-gray-50/60">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer">Cancel</button>
              <button
                onClick={() => void attach()} disabled={!canAttach || busy} data-testid="attach-confirm"
                className="px-4 py-2 text-sm font-semibold text-white bg-lira-blue hover:bg-lira-blue-hover rounded-lg shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLinkSource ? 'Add link' : staged.length > 1 ? `Attach ${staged.length} files` : 'Attach'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
