import React from 'react';
import { ListChecks, MessageSquareText } from 'lucide-react';
import { getSprintMeta, setSprintMeta } from '../../utils/sprintUtils';

interface RetroCardProps {
  sprint: string;
  scope: 'all' | number;
  /** Bumped by the parent after the retro is saved so this card re-reads it. */
  version: number;
  onEdit: () => void;
  onChanged: () => void;
}

/** The saved retrospective of a sprint. Actions can be ticked off later. */
export const RetroCard: React.FC<RetroCardProps> = ({ sprint, scope, onEdit, onChanged }) => {
  const retro = getSprintMeta(scope, sprint).retro;
  if (!retro) return null;

  const toggle = (idx: number) => {
    const actions = retro.actions.map((a, i) => (i === idx ? { ...a, done: !a.done } : a));
    setSprintMeta(scope, sprint, { retro: { ...retro, actions } });
    onChanged();
  };
  const col = (title: string, items: string[], tone: string) => (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${tone}`}>{title}</h4>
      {items.length ? <ul className="space-y-1 list-disc pl-4 text-sm text-lira-text">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-xs text-lira-muted">Nothing recorded.</p>}
    </div>
  );

  return (
    <div className="bg-white border border-lira-border rounded-xl p-5 space-y-4" data-testid="retro-card">
      <div className="flex items-center gap-2">
        <MessageSquareText className="w-4 h-4 text-lira-blue" aria-hidden />
        <h3 className="text-sm font-semibold text-lira-text">Retrospective</h3>
        {retro.savedAt && <span className="text-2xs text-lira-muted">saved {new Date(retro.savedAt).toLocaleDateString()}</span>}
        <button onClick={onEdit} className="ml-auto text-xs text-lira-blue hover:underline cursor-pointer">Edit</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-5">
        {col('What went well', retro.wentWell, 'text-green-700')}
        {col("What didn't", retro.didnt, 'text-red-700')}
      </div>
      {retro.actions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-lira-muted flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" aria-hidden /> Actions</h4>
          <ul className="space-y-1">
            {retro.actions.map((a, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-sm text-lira-text cursor-pointer">
                  <input type="checkbox" checked={a.done} onChange={() => toggle(i)} />
                  <span className={a.done ? 'line-through text-lira-muted' : ''}>{a.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
