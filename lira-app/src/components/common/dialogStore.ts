import type React from 'react';

/**
 * Lira's own confirm, prompt and alert dialogs. They replace the browser's pop-ups (window.confirm / prompt / alert)
 * everywhere, so deleting a project, a roadmap, a sprint or a space all look and behave the same.
 *
 *   if (await confirmDialog({ title: 'Delete project', message: '...', confirmLabel: 'Delete', tone: 'danger' })) ...
 *   const name = await promptDialog({ title: 'Rename', label: 'Name', defaultValue: 'Roadmap' });   // null when cancelled
 *   await alertDialog({ title: 'Cannot save', message: 'The title cannot be empty.' });
 *   const answer = await chooseDialog({ title: 'Save your comment?', confirmLabel: 'Save comment', altLabel: 'Discard comment' });  // 'confirm' | 'alt' | null
 *
 * <DialogHost /> must be rendered once, near the top of the app.
 */

export type Tone = 'danger' | 'default';

export interface Base { title: string; message?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: Tone }
export type Request =
  | (Base & { kind: 'confirm'; resolve: (v: boolean) => void })
  | (Base & { kind: 'alert'; resolve: () => void })
  | (Base & { kind: 'choose'; altLabel: string; resolve: (v: 'confirm' | 'alt' | null) => void })
  | (Base & { kind: 'prompt'; label?: string; defaultValue?: string; placeholder?: string; required?: boolean; resolve: (v: string | null) => void });

let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const currentRequest = () => queue[0];

export function confirmDialog(opts: Base): Promise<boolean> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'confirm', resolve }]; emit(); });
}

export function alertDialog(opts: Pick<Base, 'title' | 'message'> & { confirmLabel?: string }): Promise<void> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'alert', resolve }]; emit(); });
}

/** A question with two answers and a way out: 'confirm' for the main button, 'alt' for the other one, null when dismissed. */
export function chooseDialog(opts: Base & { altLabel: string }): Promise<'confirm' | 'alt' | null> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'choose', resolve }]; emit(); });
}

export function promptDialog(opts: Base & { label?: string; defaultValue?: string; placeholder?: string; required?: boolean }): Promise<string | null> {
  return new Promise(resolve => { queue = [...queue, { ...opts, kind: 'prompt', required: opts.required ?? true, resolve }]; emit(); });
}

export function finish(req: Request, value: boolean | string | null) {
  queue = queue.filter(r => r !== req);
  if (req.kind === 'confirm') req.resolve(value === true);
  else if (req.kind === 'alert') req.resolve();
  else if (req.kind === 'choose') req.resolve(value === true ? 'confirm' : value === 'alt' ? 'alt' : null);
  else req.resolve(typeof value === 'string' ? value : null);
  emit();
}

/** The answer when a dialog is dismissed (Escape, a click outside, Cancel): an alert counts as seen, a prompt as no text, a choice as not made, a confirm as "no". */
export const dismissAnswer = (req: Request): boolean | string | null => (req.kind === 'alert' ? true : req.kind === 'prompt' || req.kind === 'choose' ? null : false);

/** The text of the main button when the caller did not choose one. */
export const confirmLabelFor = (req: Request, tone: Tone): string => req.confirmLabel ?? (req.kind === 'alert' ? 'OK' : tone === 'danger' ? 'Delete' : 'Confirm');
