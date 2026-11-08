import { describe, expect, it } from 'vitest';
import { descriptionToText, isHtmlDescription, markdownToHtml, mentionsIn, toEditorHtml, toStoredHtml } from './richText';
import type { Attachment } from '../types/issue';

const att = (over: Partial<Attachment> = {}): Attachment => ({ id: 'a1', name: 'shot.png', size: 10, type: 'image/png', dataUrl: 'data:image/png;base64,AAA', createdAt: new Date(), ...over });

describe('older Markdown descriptions', () => {
  it('become headings, lists, checkboxes, code and emphasis', () => {
    const html = markdownToHtml('## Overview\nSome **bold** and *italic* and `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n- [x] done\n- [ ] todo\n\n> quoted\n\n```\nlet a = 1 < 2\n```');
    expect(html).toContain('<h2>Overview</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul><li><p>one</p></li><li><p>two</p></li></ul>');
    expect(html).toContain('<ol><li><p>first</p></li>');
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('let a = 1 &lt; 2'); // code is escaped
  });

  it('never lets markup through', () => {
    const html = markdownToHtml('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('links only to web addresses', () => {
    expect(markdownToHtml('[site](https://example.com)')).toContain('<a href="https://example.com">site</a>');
    expect(markdownToHtml('[bad](javascript:alert(1))')).not.toContain('<a');
  });

  it('tells HTML from text', () => {
    expect(isHtmlDescription('<p>hi</p>')).toBe(true);
    expect(isHtmlDescription('## hi')).toBe(false);
    expect(isHtmlDescription('')).toBe(false);
    expect(toEditorHtml('## Hi')).toContain('<h2>Hi</h2>');
    expect(toEditorHtml('<p>already</p>')).toBe('<p>already</p>');
    expect(toEditorHtml('')).toBe('');
  });
});

describe('pictures from attachments', () => {
  it('are stored by id only, and put back for the editor', () => {
    const shown = '<p>see</p><img src="data:image/png;base64,AAA" alt="shot.png" data-attachment-id="a1">';
    const stored = toStoredHtml(shown);
    expect(stored).not.toContain('base64');
    expect(stored).toContain('data-attachment-id="a1"');
    expect(toEditorHtml(stored, [att()])).toContain('src="data:image/png;base64,AAA"');
  });

  it('leave other images alone, and an empty editor stores nothing', () => {
    expect(toStoredHtml('<img src="https://x/y.png">')).toContain('src="https://x/y.png"');
    expect(toStoredHtml('<p></p>')).toBe('');
    expect(toStoredHtml('')).toBe('');
  });

  it('are left without a picture when the attachment is gone', () => {
    expect(toEditorHtml('<p>x</p><img data-attachment-id="gone">', [att()])).not.toContain('src=');
  });
});

describe('plain text for search and the AI', () => {
  it('reads HTML as text with line breaks', () => {
    const t = descriptionToText('<h2>Title</h2><p>One &amp; two</p><ul><li><p>a</p></li><li><p>b</p></li></ul><img src="x">');
    expect(t).toContain('Title');
    expect(t).toContain('One & two');
    expect(t.split('\n').filter(Boolean)).toEqual(['Title', 'One & two', 'a', 'b']);
    expect(t).not.toMatch(/[<>]/);
  });
  it('leaves Markdown and plain text as they are', () => {
    expect(descriptionToText('## Overview\nhello')).toBe('## Overview\nhello');
    expect(descriptionToText(undefined)).toBe('');
  });
});

describe('mentions', () => {
  it('are found in a stored description', () => {
    const html = '<p>hi <span data-type="mention" class="lira-mention" data-id="alex" data-label="Alex Morgan">@Alex Morgan</span> and <span data-id="sarah" data-type="mention">@Sarah</span></p>';
    expect(mentionsIn(html).sort()).toEqual(['alex', 'sarah']);
    expect(mentionsIn('plain')).toEqual([]);
  });
});
