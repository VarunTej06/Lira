import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { GROUP_ORDER, rank, type Command } from '../../utils/commandPalette';

/**
 * The command palette: one search box over the pages, the spaces, the tickets and a few actions. Arrows move, Enter runs, Escape closes,
 * and the mouse works too. It is a dialog with a combobox and a list, so a screen reader hears each result and which one is chosen.
 */
export function CommandPalette({ commands, onSearch, onClose }: { commands: (query: string) => Command[]; onSearch?: (query: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = rank(commands(query), query);
  const at = Math.min(chosen, Math.max(results.length - 1, 0));

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null; // where the person was, before the search box takes the focus
    input.current?.focus();
    // A window that was closing a moment ago (a ticket popup) may give the focus back to what opened it; the search box takes it again.
    const again = window.setTimeout(() => { if (document.activeElement !== input.current) input.current?.focus(); }, 150);
    return () => {
      window.clearTimeout(again);
      // Back to where the person was, unless a command just opened something that took the focus (a ticket popup), which keeps it.
      const now = document.activeElement;
      if (!now || now === document.body) returnTo?.focus?.();
    };
  }, []);

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setChosen(results.length ? (at + 1) % results.length : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setChosen(results.length ? (at - 1 + results.length) % results.length : 0); }
    else if (e.key === 'Home') { e.preventDefault(); setChosen(0); }
    else if (e.key === 'End') { e.preventDefault(); setChosen(Math.max(results.length - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[at]); }
    else if (e.key === 'Tab') e.preventDefault(); // focus stays in the box while the palette is open
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={key} className="w-full max-w-xl mx-4 bg-lira-surface text-lira-text border border-lira-border rounded-lg overflow-hidden">
        <input ref={input} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={results[at] ? `palette-${results[at].id}` : undefined} aria-label="Search pages, spaces and tickets"
          value={query} onChange={e => { setQuery(e.target.value); setChosen(0); onSearch?.(e.target.value); }} placeholder="Search pages, spaces and tickets, or type a command"
          className="w-full px-4 py-3 bg-transparent text-sm outline-none border-b border-lira-border placeholder:text-lira-muted" />
        <div id="palette-list" role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <p role="status" className="px-4 py-6 text-center text-ui text-lira-muted">Nothing matches “{query}”.</p>}
          {GROUP_ORDER.map(group => {
            const rows = results.filter(r => r.group === group);
            return rows.length === 0 ? null : (
              <div key={group} role="group" aria-label={group}>
                <p className="px-4 pt-2 pb-1 text-3xs font-bold uppercase tracking-wider text-lira-muted">{group}</p>
                {rows.map(r => {
                  const selected = results[at]?.id === r.id;
                  return (
                    <div key={r.id} id={`palette-${r.id}`} role="option" aria-selected={selected} onMouseMove={() => setChosen(results.indexOf(r))} onClick={() => run(r)}
                      className={`flex items-center gap-3 px-4 py-2 text-ui cursor-pointer ${selected ? 'bg-lira-blue-light' : ''}`}>
                      <span className="flex-1 truncate">{r.label}</span>
                      {r.detail && <span className="text-lira-muted text-2xs shrink-0">{r.detail}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="px-4 py-2 border-t border-lira-border text-2xs text-lira-muted">Up and down to move, Enter to open, Escape to close</p>
      </div>
    </div>,
    document.body,
  );
}
