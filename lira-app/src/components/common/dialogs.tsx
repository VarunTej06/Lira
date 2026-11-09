import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Pencil } from 'lucide-react';
import { AnimatePresence, motion } from './motionPresets';
import { dialogBackdrop, dialogPanel } from './motionPresets';
import { confirmLabelFor, currentRequest, dismissAnswer, finish, subscribe, type Request, type Tone } from './dialogStore';
import { useResetWhen } from '../../hooks/useResetWhen';

const ICON_TONE: Record<Tone, string> = { danger: 'bg-red-100 text-red-600', default: 'bg-blue-100 text-lira-blue' };

/** The round icon of a dialog: a pencil for a question with a text box, an "i" for a notice, a warning triangle for a yes/no. */
function KindIcon({ kind }: { kind: Request['kind'] }) {
  if (kind === 'prompt') return <Pencil className="w-5 h-5" />;
  return kind === 'alert' ? <Info className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />;
}

/** The labelled text box of a prompt. */
function PromptField({ req, text, onChange, inputRef }: { req: Extract<Request, { kind: 'prompt' }>; text: string; onChange: (text: string) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  return (
      <div>
        {req.label && <label htmlFor="dialog-input" className="block text-xs font-semibold text-lira-muted mb-1.5 uppercase tracking-wide">{req.label}</label>}
        <input
          id="dialog-input"
          ref={inputRef}
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={req.placeholder}
          className="w-full text-sm border border-lira-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-lira-blue focus:ring-1 focus:ring-lira-blue bg-white text-lira-text"
        />
      </div>
  );
}

export const DialogHost: React.FC = () => {
  const req = useSyncExternalStore(subscribe, currentRequest, currentRequest);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useResetWhen([req], () => {
    if (req?.kind === 'prompt') setText(req.defaultValue ?? '');
  });

  useEffect(() => {
    if (!req) return;
    const t = window.setTimeout(() => (req.kind === 'prompt' ? inputRef.current?.select() : confirmRef.current?.focus()), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(req, dismissAnswer(req)); }
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
          onMouseDown={e => { if (e.target === e.currentTarget) finish(req, dismissAnswer(req)); }}
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
                  <KindIcon kind={req.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-lira-text">{req.title}</h2>
                  {req.message && <div className="mt-1 text-sm text-lira-muted whitespace-pre-line leading-relaxed">{req.message}</div>}
                </div>
              </div>

              {req.kind === 'prompt' && <PromptField req={req} text={text} onChange={setText} inputRef={inputRef} />}

              <div className="flex justify-end gap-2 pt-1">
                {req.kind !== 'alert' && (
                  <button
                    type="button"
                    onClick={() => finish(req, dismissAnswer(req))}
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
                  {confirmLabelFor(req, tone)}
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
