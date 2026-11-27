import { useState, type FormEvent } from 'react';
import { useStoredList } from '../../../hooks/useStoredList';
import { currentTime } from '../../../utils/clock';
import { addSaved, describeSpec, hasAnyFilter, readSpec, removeSaved, sameSpec, type SavedFilter } from '../../../utils/savedFilters';
import { confirmDialog } from '../../common/dialogStore';
import type { FiltersState } from './useFiltersState';

const KEY = 'lira_saved_filters';

/** The filters this person has saved: one button each to apply it, a cross to delete it, and a way to save what is chosen now. */
export function SavedFilters({ currentSpec, applySpec, spaces }: Pick<FiltersState, 'currentSpec' | 'applySpec' | 'spaces'>) {
  const [list, save] = useStoredList<SavedFilter>(KEY);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const canSave = hasAnyFilter(currentSpec) && !list.some(f => { const s = readSpec(f.spec); return s !== null && sameSpec(s, currentSpec); });

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = addSaved(list, name, currentSpec, crypto.randomUUID(), currentTime().toISOString());
    if (result.error) { setError(result.error); return; }
    save(result.list);
    setNaming(false); setName(''); setError('');
  }
  async function remove(f: SavedFilter) {
    if (await confirmDialog({ title: `Delete "${f.name}"?`, message: 'The saved filter is deleted. Your tickets are not touched.', confirmLabel: 'Delete', tone: 'danger' })) save(removeSaved(list, f.id));
  }

  return (
    <section aria-label="Saved filters" className="flex flex-wrap items-center gap-2 mb-3 text-ui">
      <span className="font-bold text-lira-text">Saved filters</span>
      {list.length === 0 && !naming && <span className="text-lira-muted">None yet. Choose some filters and save them to come back to.</span>}
      {list.map(f => {
        const spec = readSpec(f.spec);
        const active = spec !== null && sameSpec(spec, currentSpec);
        return (
          <span key={f.id} className={`inline-flex items-center rounded border ${active ? 'border-lira-blue bg-lira-blue-light' : 'border-lira-border bg-lira-surface'}`}>
            <button type="button" disabled={!spec} aria-pressed={active} title={spec ? describeSpec(spec, spaces) : 'This saved filter can no longer be read'} onClick={() => spec && applySpec(spec)}
              className="px-2.5 py-1 text-lira-text disabled:opacity-50">{f.name}</button>
            <button type="button" aria-label={`Delete saved filter ${f.name}`} onClick={() => { void remove(f); }} className="px-1.5 py-1 text-lira-muted border-l border-lira-border">×</button>
          </span>
        );
      })}
      {naming ? (
        <form onSubmit={submit} aria-label="Save this filter" className="inline-flex items-center gap-2">
          <input autoFocus aria-label="Name for this filter" value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="Name" maxLength={80}
            onKeyDown={e => { if (e.key === 'Escape') { setNaming(false); setName(''); setError(''); } }} className="border border-lira-border rounded px-2 py-1 bg-lira-surface text-lira-text" />
          <button type="submit" className="rounded px-2.5 py-1 font-bold bg-lira-blue text-lira-on-blue">Save</button>
          <button type="button" onClick={() => { setNaming(false); setName(''); setError(''); }} className="rounded px-2.5 py-1 border border-lira-border text-lira-text">Cancel</button>
          {error && <span role="alert" className="text-red-600">{error}</span>}
        </form>
      ) : (
        <button type="button" disabled={!canSave} title={canSave ? 'Keep these filters under a name' : hasAnyFilter(currentSpec) ? 'These filters are already saved' : 'Choose some filters first'} onClick={() => setNaming(true)}
          className="rounded px-2.5 py-1 border border-lira-border text-lira-text disabled:opacity-50">Save current filter</button>
      )}
    </section>
  );
}
