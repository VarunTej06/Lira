import { fromOutline, type MindNode } from './mindmap';

export interface MindTemplate { id: string; name: string; about: string; outline: string }

/** Starting points for a new mind map, written as the same indented list that can be imported. */
export const MIND_TEMPLATES: readonly MindTemplate[] = [
  { id: 'blank', name: 'Blank', about: 'Just the central idea.', outline: '- Central idea' },
  {
    id: 'brainstorm', name: 'Brainstorm', about: 'A topic with the questions that open it up.',
    outline: '- Topic\n  - Why\n    - The problem\n    - Who has it\n  - What\n    - Ideas\n    - Options\n  - How\n    - First steps\n    - Risks\n  - Who\n    - Owner\n    - Helpers',
  },
  {
    id: 'plan', name: 'Project plan', about: 'Goals, work, people, time and risks.',
    outline: '- Project\n  - Goals\n    - Outcome\n    - How we know it worked\n  - Work\n    - Milestones\n    - Tasks\n  - People\n    - Owner\n    - Reviewers\n  - Time\n    - Start\n    - Deadline\n  - Risks\n    - What could go wrong\n    - What we do then',
  },
  {
    id: 'meeting', name: 'Meeting notes', about: 'Agenda, decisions, actions and questions.',
    outline: '- Meeting\n  - Agenda\n    - Topic one\n    - Topic two\n  - Decisions\n    - What was decided\n  - Actions\n    - Who does what\n    - By when\n  - Questions\n    - Still open',
  },
];

/** The ideas of a template, with fresh ids; an unknown template gives the blank one. */
export function fromTemplate(id: string, nextId: () => string): MindNode[] {
  const t = MIND_TEMPLATES.find(x => x.id === id) ?? MIND_TEMPLATES[0];
  return fromOutline(t.outline, nextId);
}
