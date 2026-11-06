import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { celebrate } from '../../utils/celebrate';
import type { Issue } from '../../types/issue';
import {
  completeSprint, followingSprint, getSprintMeta, isDone, setSprintMeta, sprintLabel, sprintName, sprintStart, type Retro,
} from '../../utils/sprintUtils';

interface CloseSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprint: string;
  scope: 'all' | number;
  /** The tickets of this sprint in the current scope. */
  list: Issue[];
  keys: string[];
  /** Called after saving, with a short message to show. */
  onSaved: (message: string) => void;
}

const lines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);
const toText = (xs: string[]) => xs.join('\n');

/**
 * Closes a sprint: unfinished tickets are carried over to the sprint you pick, and the retrospective
 * (what went well, what didn't, actions) is saved with the sprint. A closed sprint can reopen this to edit its retro.
 */
export const CloseSprintModal: React.FC<CloseSprintModalProps> = ({ isOpen, onClose, sprint, scope, list, keys, onSaved }) => {
  const meta = getSprintMeta(scope, sprint);
  const closed = !!meta.completedAt;
  const unfinished = list.filter(i => !isDone(i));
  const later = keys.filter(k => sprintStart(k) > sprintStart(sprint));
  const [target, setTarget] = useState(followingSprint(sprint, keys));
  const [well, setWell] = useState('');
  const [didnt, setDidnt] = useState('');
  const [actions, setActions] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const r = getSprintMeta(scope, sprint).retro;
    setTarget(followingSprint(sprint, keys));
    setWell(toText(r?.wentWell ?? []));
    setDidnt(toText(r?.didnt ?? []));
    setActions(toText((r?.actions ?? []).map(a => a.text)));
    setBusy(false);
  }, [isOpen, sprint, scope, keys]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const previous = getSprintMeta(scope, sprint).retro?.actions ?? [];
    const retro: Retro = {
      wentWell: lines(well),
      didnt: lines(didnt),
      // an action that was already ticked stays ticked when the text is unchanged
      actions: lines(actions).map(text => ({ text, done: previous.some(a => a.text === text && a.done) })),
      savedAt: new Date().toISOString(),
    };
    const hasRetro = retro.wentWell.length + retro.didnt.length + retro.actions.length > 0;
    let moved = 0;
    if (!closed) { moved = await completeSprint(list, sprint, scope, target); celebrate('sprint'); }
    if (hasRetro) setSprintMeta(scope, sprint, { retro });
    onSaved(
      closed
        ? 'Retrospective saved'
        : `${sprintName(sprint)} closed${moved ? ` · ${moved} unfinished ticket${moved > 1 ? 's' : ''} carried over to ${sprintName(target)}` : ''}${hasRetro ? ' · retrospective saved' : ''}`,
    );
    onClose();
  };

  const area = (id: string, label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-jira-muted mb-1.5 uppercase tracking-wide">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={e => set(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full text-sm border border-jira-border rounded-xl px-3 py-2 focus:outline-none focus:border-jira-blue bg-white resize-y"
      />
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={closed ? `Retrospective · ${sprintLabel(sprint)}` : `Close ${sprintName(sprint)}`} size="lg">
      <form onSubmit={save} className="p-6 space-y-5">
        {!closed && (
          <div className="rounded-xl border border-jira-border bg-gray-50 px-4 py-3 text-sm text-jira-text space-y-2">
            <p>
              <strong>{list.length - unfinished.length}</strong> of {list.length} ticket{list.length === 1 ? '' : 's'} done.
              {unfinished.length > 0
                ? <> <strong>{unfinished.length}</strong> unfinished ticket{unfinished.length === 1 ? '' : 's'} will be carried over.</>
                : ' Nothing to carry over.'}
            </p>
            {unfinished.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-jira-muted">
                Carry over to
                <select
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className="text-sm border border-jira-border rounded-lg px-2 py-1 bg-white text-jira-text cursor-pointer"
                  aria-label="Carry unfinished tickets over to"
                >
                  {Array.from(new Set([target, ...later])).map(k => <option key={k} value={k}>{sprintName(k)}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <p className="text-xs text-jira-muted">One point per line. The retrospective is saved with the sprint and is optional.</p>
        {area('retro-well', 'What went well', well, setWell, 'Pairing on the hard tickets…')}
        {area('retro-didnt', "What didn't", didnt, setDidnt, 'Scope grew after day two…')}
        {area('retro-actions', 'Actions for next sprint', actions, setActions, 'Freeze scope after the first day')}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{closed ? 'Save retrospective' : 'Close sprint'}</Button>
        </div>
      </form>
    </Modal>
  );
};
