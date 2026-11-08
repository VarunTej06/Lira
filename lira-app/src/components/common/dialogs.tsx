import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Pencil } from 'lucide-react';
import { AnimatePresence, motion, dialogBackdrop, dialogPanel } from './motion';

/**
 * Lira's own confirm, prompt and alert dialogs. They replace the browser's pop-ups (window.confirm / prompt / alert)
 * everywhere, so deleting a project, a roadmap, a sprint or a space all look and behave the same.
 *
 *   if (await confirmDialog({ title: 'Delete project', message: '...', confirmLabel: 'Delete', tone: 'danger' })) ...
 *   const name = await promptDialog({ title: 'Rename', label: 'Name', defaultValue: 'Roadmap' });   // null when cancelled
 *   await alertDialog({ title: 'Cannot save', message: 'The title cannot be empty.' });
 *
 * <DialogHost /> must be rendered once, near the top of the app.
 */

type Tone = 'danger' | 'default';

interface Base { title: string; message?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: Tone }
type Request =
  | (Base & { kind: 'confirm'; resolve: (v: boolean) => void })
  | (Base & { kind: 'alert'; resolve: () => void })
  | (Base & { kind: 'prompt'; label?: string; defaultValue?: string; placeholder?: string; required?: boolean; resolve: (v: string | null) => void });

let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const current = () => queue[0];

export function confirmDialog(opts: Base): Promise<boolean> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'confirm', resolve }]; emit(); });
}

export function alertDialog(opts: Pick<Base, 'title' | 'message'> & { confirmLabel?: string }): Promise<void> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'alert', resolve }]; emit(); });
}

export function promptDialog(opts: Base & { label?: string; defaultValue?: string; placeholder?: string; required?: boolean }): Promise<string | null> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'prompt', required: opts.required ?? true, resolve }]; emit(); });
}

function finish(req: Request, value: boolean | string | null) {
  queue = queue.filter(r => r !== req);
  if (req.kind === 'confirm') req.resolve(value === true);
  else if (req.kind === 'alert') req.resolve();
  else req.resolve(typeof value === 'string' ? value : null);
  emit();
}

const ICON_TONE: Record<Tone, string> = { danger: 'bg-red-100 text-red-600', default: 'bg-blue-100 text-lira-blue' };

export const DialogHost: React.FC = () => {
  const req = useSyncExternalStore(subscribe, current, current);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (req?.kind === 'prompt') setText(req.defaultValue ?? '');
  }, [req]);

  useEffect(() => {
    if (!req) return;
    const t = window.setTimeout(() => (req.kind === 'prompt' ? inputRef.current?.select() : confirmRef.current?.focus()), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(req, req.kind === 'alert' ? true : req.kind === 'prompt' ? null : false); }
    };
    document.addEventListener('keydown', onKey, true); // before any dialog underneath sees Escape
    return () => { window.clearTimeout(t); document.removeEventListener('keydown', onKey, true); };
  }, [req]);

  const tone: Tone = req?.tone ?? 'default';
  const isPrompt = req?.kind === 'prompt';
  const blocked = isPrompt && req.required && !text.trim();

  const submit = () => {
    if (!req) return;
    if (req.kind === 'prompt') { if (!blocked) finish(req, text.trim()); }
    else finish(req, true);
  };

  return createPortal(
    <AnimatePresence>
      {req && (
        <motion.div
          key="dialog-host"
          {...dialogBackdrop}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) finish(req, req.kind === 'alert' ? true : req.kind === 'prompt' ? null : false); }}
        >
          <motion.div
            {...dialogPanel}
            role={req.kind === 'alert' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-label={req.title}
            className="bg-white rounded-xl shadow-2xl border border-lira-border w-full max-w-md overflow-hidden"
          >
            <form onSubmit={e => { e.preventDefault(); submit(); }} className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${ICON_TONE[tone]}`}>
                  {isPrompt ? <Pencil className="w-5 h-5" /> : req.kind === 'alert' ? <Info className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-lira-text">{req.title}</h2>
                  {req.message && <div className="mt-1 text-sm text-lira-muted whitespace-pre-line leading-relaxed">{req.message}</div>}
                </div>
              </div>

              {req.kind === 'prompt' && (
                <div>
                  {req.label && <label htmlFor="dialog-input" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">{req.label}</label>}
                  <input
                    id="dialog-input"
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={req.placeholder}
                    className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                {req.kind !== 'alert' && (
                  <button
                    type="button"
                    onClick={() => finish(req, req.kind === 'prompt' ? null : false)}
                    className="px-4 py-2 text-sm font-medium text-lira-muted hover:text-lira-text rounded-lg cursor-pointer"
                  >
                    {req.cancelLabel ?? 'Cancel'}
                  </button>
                )}
                <button
                  ref={confirmRef}
                  type="submit"
                  disabled={blocked}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-lira-blue hover:bg-lira-blue-hover'
                  }`}
                >
                  {req.confirmLabel ?? (req.kind === 'alert' ? 'OK' : tone === 'danger' ? 'Delete' : 'Confirm')}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
