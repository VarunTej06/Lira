import { MIND_COLORS } from '../theme/palette';
import { newShape, type FontSize, type FreeDoc, type Link, type Shape, type ShapeKind } from './mindFree';
import { fromOutline, type MindNode } from './mindmap';

/** A shape of a template, placed by its top left corner. `key` is how the lines of the template refer to it; 'root' is the central idea. */
interface ShapeSpec { key: string; kind: ShapeKind; x: number; y: number; w?: number; h?: number; text: string; color?: string; bold?: boolean; size?: FontSize }
interface LinkSpec { from: string; to: string; dashed?: boolean }
export interface MindTemplate { id: string; name: string; about: string; outline: string; shapes?: readonly ShapeSpec[]; links?: readonly LinkSpec[] }

const [BLUE, GREEN, ORANGE, CORAL, CYAN, , AMBER] = MIND_COLORS;

/** A block of sticky notes in columns and rows, starting at the top left corner. */
function notes(prefix: string, texts: readonly string[], x0: number, y0: number, cols: number, colors: readonly string[], stepX = 190, stepY = 130): ShapeSpec[] {
  return texts.map((text, i) => ({ key: `${prefix}${i}`, kind: 'note' as const, x: x0 + (i % cols) * stepX, y: y0 + Math.floor(i / cols) * stepY, w: 170, h: 110, text, color: colors[Math.floor(i / cols) % colors.length] }));
}
/** The heading of a column: a box wide as the notes under it. */
const header = (key: string, text: string, x: number, y: number, color: string, w = 170): ShapeSpec => ({ key, kind: 'box', x, y, w, h: 44, text, color, bold: true });

/**
 * Starting points for a new storyboard. Each is a different kind of board, written as an indented list for the map of ideas in the middle
 * and a set of shapes and lines around it: a wall of sticky notes, meeting notes, a retrospective in columns, a decision, a flowchart.
 * Shapes sit above or below the map so that nothing overlaps whatever the template holds.
 */
export const MIND_TEMPLATES: readonly MindTemplate[] = [
  { id: 'blank', name: 'Blank', about: 'Just the central idea, and room to draw.', outline: '- Central idea' },
  {
    id: 'mindmap', name: 'Mind map', about: 'A topic with branches and twigs.',
    outline: '- Topic\n  - Why\n    - The problem\n    - Who has it\n  - What\n    - Ideas\n    - Options\n  - How\n    - First steps\n    - Risks\n  - Who\n    - Owner\n    - Helpers',
  },
  {
    id: 'brainstorm', name: 'Brainstorm', about: 'A wall of sticky notes, and the top picks as a map.',
    outline: '- Top picks\n  - Pick one\n    - Why it wins\n  - Pick two\n    - Why it wins\n  - Next steps\n    - Who\n    - When',
    shapes: [
      { key: 'title', kind: 'text', x: -330, y: -590, w: 660, h: 34, text: 'What do we want to solve? One idea on each note.', bold: true, size: 'large' },
      ...notes('idea', Array.from({ length: 12 }, () => 'Idea'), -360, -520, 4, [AMBER, BLUE, GREEN]),
    ],
  },
  {
    id: 'meeting', name: 'Meeting notes', about: 'Sticky notes for the agenda, notes and actions, and a small map of the decisions.',
    outline: '- Decisions\n  - Decision 1\n    - Why\n    - Who agreed\n  - Decision 2\n    - Why\n    - Who agreed\n  - Follow-ups\n    - Owner\n    - Date',
    shapes: [
      header('hAgenda', 'Agenda', -420, -640, BLUE, 190), header('hNotes', 'Notes', -210, -640, GREEN, 190), header('hDecisions', 'Decisions', 0, -640, ORANGE, 190), header('hActions', 'Actions', 210, -640, CORAL, 190),
      ...[['Agenda', -420, BLUE], ['Notes', -210, GREEN], ['Decision', 0, ORANGE], ['Action', 210, CORAL]].flatMap(([t, x, c]) => [0, 1].map(r => ({ key: `n${t}${r}`, kind: 'note' as const, x: x as number, y: -580 + r * 130, w: 190, h: 110, text: `${t} ${r + 1}`, color: c as string }))),
    ],
  },
  {
    id: 'retro', name: 'Retrospective', about: 'What went well, what to improve and the actions, as sticky notes.',
    outline: '- Retrospective\n  - Themes\n    - Theme one\n    - Theme two\n  - Next time\n    - Keep\n    - Change',
    shapes: [
      header('hWell', 'Went well', -330, -600, GREEN, 190), header('hImprove', 'To improve', -110, -600, CORAL, 190), header('hActions', 'Actions', 110, -600, BLUE, 190),
      ...[['Went well', -330, GREEN], ['To improve', -110, CORAL], ['Action', 110, BLUE]].flatMap(([t, x, c]) => [0, 1, 2].map(r => ({ key: `r${t}${r}`, kind: 'note' as const, x: x as number, y: -540 + r * 130, w: 190, h: 110, text: `${t} ${r + 1}`, color: c as string }))),
    ],
  },
  {
    id: 'decision', name: 'Decision', about: 'The question, the options as a map, and the decision.',
    outline: '- Decision\n  - Option A\n    - Pro\n    - Con\n  - Option B\n    - Pro\n    - Con',
    shapes: [
      { key: 'question', kind: 'ellipse', x: -140, y: -330, w: 280, h: 90, text: 'What are we deciding?', bold: true, color: BLUE },
      { key: 'criteria', kind: 'note', x: -460, y: 230, w: 190, h: 110, text: 'Criteria: what matters most?', color: AMBER },
      { key: 'final', kind: 'box', x: -110, y: 230, w: 220, h: 80, text: 'We decided:', bold: true, color: GREEN, size: 'large' },
      { key: 'risks', kind: 'note', x: 270, y: 230, w: 190, h: 110, text: 'Risks and what we do about them', color: CORAL },
    ],
    links: [{ from: 'question', to: 'root' }, { from: 'root', to: 'final' }],
  },
  {
    id: 'flowchart', name: 'Flowchart', about: 'Steps joined by arrows, with a yes and a no.',
    outline: '- Process',
    shapes: [
      { key: 'start', kind: 'ellipse', x: -480, y: 160, w: 120, h: 60, text: 'Start', color: GREEN },
      { key: 'step1', kind: 'box', x: -320, y: 150, w: 140, h: 80, text: 'First step' },
      { key: 'check', kind: 'box', x: -140, y: 150, w: 160, h: 80, text: 'Is it ready?', bold: true, color: AMBER },
      { key: 'step2', kind: 'box', x: 60, y: 150, w: 140, h: 80, text: 'Next step' },
      { key: 'end', kind: 'ellipse', x: 240, y: 160, w: 120, h: 60, text: 'Done', color: CYAN },
      { key: 'fix', kind: 'box', x: -140, y: 300, w: 160, h: 70, text: 'Fix it', color: CORAL },
      { key: 'yes', kind: 'text', x: 22, y: 160, w: 36, h: 24, text: 'yes', size: 'small' },
      { key: 'no', kind: 'text', x: -70, y: 244, w: 36, h: 24, text: 'no', size: 'small' },
    ],
    links: [{ from: 'start', to: 'step1' }, { from: 'step1', to: 'check' }, { from: 'check', to: 'step2' }, { from: 'step2', to: 'end' }, { from: 'check', to: 'fix', dashed: true }, { from: 'fix', to: 'step1', dashed: true }],
  },
];

/** The ideas and the shapes and lines of a template, with fresh ids; an unknown template gives the blank one. */
export function fromTemplate(id: string, nextId: () => string): { nodes: MindNode[]; free: FreeDoc } {
  const t = MIND_TEMPLATES.find(x => x.id === id) ?? MIND_TEMPLATES[0];
  const nodes = fromOutline(t.outline, nextId);
  const ids = new Map<string, string>([['root', nodes[0]?.id ?? '']]);
  const shapes: Shape[] = (t.shapes ?? []).map(spec => {
    const made = newShape(spec.kind, nextId(), 0, 0);
    ids.set(spec.key, made.id);
    const { key: _key, ...rest } = spec;
    return { ...made, ...rest, w: spec.w ?? made.w, h: spec.h ?? made.h };
  });
  const links: Link[] = (t.links ?? []).map(l => ({ id: nextId(), from: ids.get(l.from)!, to: ids.get(l.to)!, arrow: true, dashed: l.dashed }));
  return { nodes, free: { shapes, links, comments: [] } };
}
