import { describe, expect, it } from 'vitest';
import { markdownToHtml } from './richText';

describe('markdownToHtml: block by block', () => {
  it('turns lines into one paragraph with line breaks, and a blank line starts a new paragraph', () => {
    expect(markdownToHtml('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>');
  });

  it('reads headings, capping the level at 3', () => {
    expect(markdownToHtml('# A\n###### B')).toBe('<h1>A</h1><h3>B</h3>');
  });

  it('keeps bullets and numbers as separate lists, and a bullet list stops at the next kind of line', () => {
    expect(markdownToHtml('- a\n- b\n1. c\n2) d'))
      .toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul><ol><li><p>c</p></li><li><p>d</p></li></ol>');
  });

  it('reads a checklist as tasks, not as bullets, and remembers which are ticked', () => {
    const html = markdownToHtml('- [x] done\n- [ ] todo');
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).not.toContain('<ul><li>');
  });

  it('joins consecutive quote lines into one quote', () => {
    expect(markdownToHtml('> a\n> b')).toBe('<blockquote><p>a<br>b</p></blockquote>');
  });

  it('keeps a code block as written and escapes its content', () => {
    expect(markdownToHtml('```\nif (a < b) {}\n```')).toBe('<pre><code>if (a &lt; b) {}</code></pre>');
  });

  it('closes a code block that never ends, taking the rest of the text', () => {
    expect(markdownToHtml('```\nlet a\nlet b')).toBe('<pre><code>let a\nlet b</code></pre>');
  });

  it('ends a paragraph where a block starts, without a blank line', () => {
    expect(markdownToHtml('text\n## Title\nmore')).toBe('<p>text</p><h2>Title</h2><p>more</p>');
  });

  it('handles Windows line endings and empty text', () => {
    expect(markdownToHtml('a\r\n\r\nb')).toBe('<p>a</p><p>b</p>');
    expect(markdownToHtml('')).toBe('');
  });
});
