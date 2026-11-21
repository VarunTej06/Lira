import { describe, expect, it } from 'vitest';
import { NO_COMMENT_DRAFT, hasCommentContent, newComment, plainToCommentHtml } from './commentUtils';

describe('a comment being written', () => {
  it('starts with no text and no files, and has nothing to save', () => {
    expect(NO_COMMENT_DRAFT).toEqual({ html: '', files: [] });
    expect(hasCommentContent(NO_COMMENT_DRAFT.html, NO_COMMENT_DRAFT.files)).toBe(false);
  });
  it('has something to save with text or a file, not with only spaces or an empty paragraph', () => {
    expect(hasCommentContent('<p>Hi</p>', [])).toBe(true);
    expect(hasCommentContent('', [{ id: 'f' } as never])).toBe(true);
    expect(hasCommentContent('<p>   </p>', [])).toBe(false);
  });
  it('becomes a comment by the person using Lira, with the text, the files and the time', () => {
    const now = new Date(2026, 10, 13, 9);
    const files = [{ id: 'f' } as never];
    const c = newComment({ html: '<p>Hi</p>', files }, now);
    expect(c).toMatchObject({ content: '<p>Hi</p>', attachments: files, createdAt: now });
    expect(c.author).toBe(c.authorInitials);
    expect(c.id).not.toBe(newComment({ html: 'x', files: [] }).id);
  });
  it('has no length limit', () => {
    const long = '<p>' + 'word '.repeat(50000) + '</p>';
    expect(newComment({ html: long, files: [] }).content).toHaveLength(long.length);
  });
});

describe('typed text becoming a comment', () => {
  it('escapes markup so nothing typed can run, and keeps line breaks and paragraphs', () => {
    expect(plainToCommentHtml('<img src=x onerror=alert(1)> & "q"')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;</p>');
    expect(plainToCommentHtml('one\ntwo\r\n\r\nthree')).toBe('<p>one<br>two</p><p>three</p>');
    expect(plainToCommentHtml('  hi  ')).toBe('<p>hi</p>');
  });
});
