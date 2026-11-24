import { Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type PointerEvent } from 'react';
import { pinAt, type Item, type MindComment } from '../../utils/mindFree';

/** The small round pins of the comments, drawn on the map so they move and zoom with it. Resolved ones are quiet. */
export function CommentPins({ comments, items, selected, onPin }: { comments: readonly MindComment[]; items: ReadonlyMap<string, Item>; selected: string | null; onPin: (e: PointerEvent, id: string) => void }) {
  return (
    <g>
      {comments.map((c, i) => {
        const p = pinAt(c, items);
        return (
          <g key={c.id} data-comment-id={c.id} transform={`translate(${p.x} ${p.y})`} onPointerDown={e => onPin(e, c.id)} role="button" aria-label={`Comment ${i + 1}${c.resolved ? ', resolved' : ''}`} className="cursor-pointer">
            <circle r={11} className={`${c.resolved ? 'fill-lira-muted' : 'fill-lira-blue'} ${selected === c.id ? 'stroke-lira-text' : 'stroke-lira-surface'}`} strokeWidth={2} />
            <text textAnchor="middle" y={4} className="text-2xs fill-lira-on-blue font-semibold">{i + 1}</text>
          </g>
        );
      })}
    </g>
  );
}

const when = (iso: string): string => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const BTN = 'p-1.5 rounded-lg text-lira-muted hover:bg-gray-100 hover:text-lira-text cursor-pointer';

/** A comment shown in a small box beside its pin: who and when, the words, and edit, resolve and delete. */
export function CommentCard({ comment, x, y, onEdit, onResolve, onDelete, onClose }: { comment: MindComment; x: number; y: number; onEdit: (text: string) => void; onResolve: () => void; onDelete: () => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  return (
    <section aria-label="Comment" style={{ left: x, top: y }} className="absolute z-10 w-64 bg-white border border-lira-border rounded-2xl p-3 space-y-2 text-sm text-lira-text">
      <header className="flex items-center gap-2 text-2xs text-lira-muted">
        <span className="font-semibold text-lira-text">{comment.author}</span><span>{when(comment.at)}{comment.editedAt ? ' (edited)' : ''}</span>
        {comment.resolved && <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Resolved</span>}
        <button type="button" aria-label="Close the comment" onClick={onClose} className="ml-auto cursor-pointer text-lira-muted hover:text-lira-text">Close</button>
      </header>
      {editing ? (
        <form onSubmit={e => { e.preventDefault(); onEdit(text); setEditing(false); }} className="space-y-2">
          <textarea aria-label="Edit the comment" autoFocus rows={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} className="w-full text-sm border border-lira-border rounded-xl px-3 py-2 bg-white text-lira-text focus:outline-none focus:border-lira-blue" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setText(comment.text); setEditing(false); }} className="px-3 py-1 text-xs rounded-lg border border-lira-border bg-white cursor-pointer">Cancel</button>
            <button type="submit" disabled={!text.trim()} className="px-3 py-1 text-xs font-semibold rounded-lg bg-lira-blue text-lira-on-blue disabled:opacity-50 cursor-pointer">Save</button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words">{comment.text}</p>
          <div className="flex gap-1 -mx-1.5">
            <button type="button" aria-label="Edit the comment text" title="Edit" onClick={() => { setText(comment.text); setEditing(true); }} className={BTN}><Pencil className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={comment.resolved ? 'Open the comment again' : 'Mark the comment as resolved'} title={comment.resolved ? 'Open again' : 'Resolve'} onClick={onResolve} className={BTN}>{comment.resolved ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}</button>
            <button type="button" aria-label="Delete the comment" title="Delete" onClick={onDelete} className={`${BTN} ml-auto`}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </>
      )}
    </section>
  );
}

/** The comment card or the box for a new comment, put beside the pin on the screen however the map is moved and zoomed. */
export function CommentOverlay({ comments, selected, composer, items, toScreen, onSubmit, onCancel, onEdit, onResolve, onDelete, onClose }: {
  comments: readonly MindComment[]; selected: string | null; composer: { targetId: string | null; x: number; y: number } | null; items: ReadonlyMap<string, Item>;
  toScreen: (p: { x: number; y: number }) => { x: number; y: number };
  onSubmit: (text: string) => void; onCancel: () => void; onEdit: (id: string, text: string) => void; onResolve: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const beside = (p: { x: number; y: number }) => { const s = toScreen(p); return { x: s.x + 16, y: s.y + 8 }; };
  const open = composer ? null : comments.find(c => c.id === selected);
  const at = composer ? beside(composer.targetId ? (() => { const t = items.get(composer.targetId); return t ? { x: t.x + t.w, y: t.y } : composer; })() : composer) : open ? beside(pinAt(open, items)) : null;
  if (!at) return null;
  return composer
    ? <CommentComposer x={at.x} y={at.y} onSubmit={onSubmit} onCancel={onCancel} />
    : open && <CommentCard key={open.id} comment={open} x={at.x} y={at.y} onEdit={t => onEdit(open.id, t)} onResolve={() => onResolve(open.id)} onDelete={() => onDelete(open.id)} onClose={onClose} />;
}

/** The small box to write a new comment in, where the pin will go. */
export function CommentComposer({ x, y, onSubmit, onCancel }: { x: number; y: number; onSubmit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('');
  return (
    <form aria-label="New comment" style={{ left: x, top: y }} onSubmit={e => { e.preventDefault(); onSubmit(text); }} className="absolute z-10 w-64 bg-white border border-lira-border rounded-2xl p-3 space-y-2">
      <textarea aria-label="Write a comment" autoFocus rows={3} maxLength={1000} placeholder="Write a comment" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onCancel(); }} className="w-full text-sm border border-lira-border rounded-xl px-3 py-2 bg-white text-lira-text focus:outline-none focus:border-lira-blue" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1 text-xs rounded-lg border border-lira-border bg-white text-lira-text cursor-pointer">Cancel</button>
        <button type="submit" disabled={!text.trim()} className="px-3 py-1 text-xs font-semibold rounded-lg bg-lira-blue text-lira-on-blue disabled:opacity-50 cursor-pointer">Comment</button>
      </div>
    </form>
  );
}
