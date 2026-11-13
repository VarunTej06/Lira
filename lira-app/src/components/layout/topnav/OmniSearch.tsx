import { isEditable } from '../../../utils/isEditable';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { Issue } from '../../../types/issue';
import type { Space } from '../../../types/space';
import { useClickOutside, fuzzyMatch } from './shared';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useResetWhen } from '../../../hooks/useResetWhen';

export const OmniSearch: React.FC<{
  issues: Issue[];
  spaces: Space[];
  onSelectIssue?: (issue: Issue) => void;
}> = ({ issues, spaces, onSelectIssue }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  // On a phone the search is a button; tapping it opens the search box across the top of the screen.
  const phone = useMediaQuery('(max-width: 639px)');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => { setOpen(false); setPhoneOpen(false); });

  const spaceMap = useMemo(() => {
    const map: Record<number, Space> = {};
    spaces.forEach(s => { if (s.id) map[s.id] = s; });
    return map;
  }, [spaces]);

  // Global hotkey: Ctrl+K or /
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = isEditable(document.activeElement); // also the comment and description editors, which are not <input>s
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === '/' && !inInput) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return issues.filter(issue => {
      return (
        fuzzyMatch(query, issue.key) ||
        fuzzyMatch(query, issue.title) ||
        issue.labels?.some(l => fuzzyMatch(query, l))
      );
    }).slice(0, 10);
  }, [issues, query]);

  useResetWhen([results], () => setSelectedIdx(0));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[selectedIdx];
      if (target) {
        onSelectIssue?.(target);
        setQuery('');
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    results.forEach(issue => {
      const sName = spaceMap[issue.spaceId]?.name ?? 'Other';
      if (!map[sName]) map[sName] = [];
      map[sName].push(issue);
    });
    return map;
  }, [results, spaceMap]);

  let flatIdx = 0;

  if (phone && !phoneOpen) {
    return (
      <button
        onClick={() => { setPhoneOpen(true); window.setTimeout(() => inputRef.current?.focus(), 50); }}
        aria-label="Search work items"
        className="flex-shrink-0 ml-auto w-9 h-9 rounded-xl bg-white/10 border border-white/10 text-white/70 flex items-center justify-center cursor-pointer"
      >
        <Search className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className={phone ? 'fixed left-3 right-3 top-3 z-[70] bg-lira-nav rounded-2xl p-2 shadow-2xl border border-white/10' : 'flex-1 min-w-0 max-w-xs mx-1 sm:mx-2 relative'}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search work items..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="w-full bg-white/10 text-white placeholder-white/40 text-xs rounded-xl pl-8 pr-7 py-2 border border-white/10 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
        />
        {query ? (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-white/30 font-mono">/</kbd>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-lira-nav border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in origin-top-left overflow-hidden transition-all duration-150 animate-scale-in">
          <div className="max-h-72 overflow-y-auto py-1">
            {Object.entries(grouped).map(([spaceName, spaceIssues]) => (
              <div key={spaceName}>
                <div className="px-3 py-1.5 text-3xs font-semibold text-white/40 uppercase tracking-wider">{spaceName}</div>
                {spaceIssues.map(issue => {
                  const idx = flatIdx++;
                  return (
                    <button
                      key={issue.key}
                      onClick={() => { onSelectIssue?.(issue); setQuery(''); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all duration-150 cursor-pointer ${
                        selectedIdx === idx ? 'bg-white/15' : 'hover:bg-white/10'
                      }`}
                    >
                      <span className="text-3xs font-mono text-lira-nav-accent font-bold flex-shrink-0">{issue.key}</span>
                      <span className="text-xs text-white/80 truncate flex-1">{issue.title}</span>
                      <span className="text-3xs text-white/30 flex-shrink-0 hidden sm:block">{spaceMap[issue.spaceId]?.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 px-3 py-1.5 flex gap-3 text-3xs text-white/30">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">Enter</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  );
};
