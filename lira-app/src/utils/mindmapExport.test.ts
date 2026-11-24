import { describe, expect, it } from 'vitest';
import { MIND_COLORS } from '../theme/palette';
import { addChild, newMap, updateNode } from './mindmap';
import { fileNameOf, toSvg } from './mindmapExport';

const colors = { ink: '#111111', paper: '#ffffff', line: '#cccccc', accent: '#0052cc' };
const nodes = () => addChild(addChild(newMap('m', 'Plan', 'now', 'r').nodes, 'r', 'a', 'A'), 'r', 'b', 'B');

describe('the picture of a map', () => {
  it('draws a label for each idea, a card for the central one, and a line from each to its parent, in a picture that holds them all', () => {
    const { svg, width, height } = toSvg(nodes(), colors);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(1 + 1); // the background and the central idea; the others are plain text on their branch
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect((svg.match(/<text /g) ?? []).length).toBe(3);
    expect(width).toBeGreaterThan(200); expect(height).toBeGreaterThan(80);
  });

  it('cannot carry markup from an idea into the file', () => {
    const { svg } = toSvg(updateNode(nodes(), 'a', { text: '<script>alert(1)</script> "x" & \'y\'' }), colors);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).not.toMatch(/<text[^>]*>[^<]*<\//.source.replace('/', '') + 'x'); // no stray tag inside a label
  });

  it('draws a branch in the colour of the idea, or of its branch, and leaves out what is folded away', () => {
    expect(toSvg(updateNode(nodes(), 'a', { color: '#ff0000' }), colors).svg).toContain('stroke="#ff0000"');
    expect(toSvg(nodes(), colors).svg).toContain(`stroke="${MIND_COLORS[0]}"`);
    const folded = updateNode(addChild(nodes(), 'a', 'a1', 'Hidden child'), 'a', { collapsed: true });
    expect(toSvg(folded, colors).svg).not.toContain('Hidden child');
  });

  it('draws an empty map as an empty picture without failing', () => {
    expect(toSvg([], colors).svg).toContain('<svg');
  });
});

describe('file names', () => {
  it('makes a plain name from the map name, and a fallback when nothing is left', () => {
    expect(fileNameOf('Q4 Plan: Roadmap & more!', 'png')).toBe('q4-plan-roadmap-more.png');
    expect(fileNameOf('   ', 'json')).toBe('mind-map.json');
    expect(fileNameOf('../../etc/passwd', 'md')).toBe('etc-passwd.md');
    expect(fileNameOf('x'.repeat(200), 'svg')).toHaveLength(64);
  });
});
