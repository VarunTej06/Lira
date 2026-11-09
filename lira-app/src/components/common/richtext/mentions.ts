import type { SuggestionOptions } from '@tiptap/suggestion';
import { loadDirectory } from '../../../utils/standupUtils';

interface MentionPerson { id: string; label: string }

const BASE_PEOPLE: MentionPerson[] = [
  { id: 'varuntej', label: 'Varuntej Yadla' },
  { id: 'alex', label: 'Alex Morgan' },
  { id: 'sarah', label: 'Sarah Connor' },
  { id: 'devteam', label: 'Dev Team' },
];

/** People that can be mentioned: the built-in team plus anyone added to a team directory. */
function mentionCandidates(): MentionPerson[] {
  const extra = Object.values(loadDirectory()).map(m => ({ id: m.key, label: m.name || m.email }));
  const seen = new Set<string>();
  return [...BASE_PEOPLE, ...extra].filter(p => !seen.has(p.label.toLowerCase()) && !!seen.add(p.label.toLowerCase()));
}

/**
 * The list that appears under the cursor after typing "@". Up and Down move, Enter or Tab picks, Escape closes.
 * It is plain DOM (no React) because TipTap calls these hooks outside the React tree.
 */
export const mentionSuggestion: Omit<SuggestionOptions<MentionPerson>, 'editor'> = {
  char: '@',
  items: ({ query }) => mentionCandidates().filter(p => p.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6),
  render: () => {
    let el: HTMLDivElement | null = null;
    let items: MentionPerson[] = [];
    let index = 0;
    let command: ((p: MentionPerson) => void) | null = null;

    const draw = () => {
      if (!el) return;
      el.innerHTML = '';
      if (!items.length) {
        const none = document.createElement('div');
        none.className = 'lira-mention-empty';
        none.textContent = 'No one found';
        el.appendChild(none);
        return;
      }
      items.forEach((p, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `lira-mention-item${i === index ? ' is-selected' : ''}`;
        b.textContent = p.label;
        b.addEventListener('mousedown', e => { e.preventDefault(); command?.(p); });
        el!.appendChild(b);
      });
    };
    const place = (rect: DOMRect | null | undefined) => {
      if (!el || !rect) return;
      el.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
      el.style.top = `${rect.bottom + 6}px`;
    };

    return {
      onStart: props => {
        el = document.createElement('div');
        el.className = 'lira-mention-list';
        el.setAttribute('role', 'listbox');
        el.setAttribute('aria-label', 'Mention a person');
        document.body.appendChild(el);
        items = props.items;
        index = 0;
        command = props.command;
        draw();
        place(props.clientRect?.());
      },
      onUpdate: props => {
        items = props.items;
        index = 0;
        command = props.command;
        draw();
        place(props.clientRect?.());
      },
      onKeyDown: ({ event }) => {
        if (event.key === 'Escape') { el?.remove(); el = null; return true; }
        if (!items.length) return false;
        if (event.key === 'ArrowDown') { index = (index + 1) % items.length; draw(); return true; }
        if (event.key === 'ArrowUp') { index = (index - 1 + items.length) % items.length; draw(); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { command?.(items[index]); return true; }
        return false;
      },
      onExit: () => { el?.remove(); el = null; },
    };
  },
};
