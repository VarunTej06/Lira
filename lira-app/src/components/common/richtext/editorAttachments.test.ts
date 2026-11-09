import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import type { Attachment } from '../../../types/issue';
import { insertAttachment, screenshotName } from './editorAttachments';

/** An editor that only records what is inserted. */
function fakeEditor() {
  const inserted: unknown[] = [];
  const chain = { focus: () => chain, insertContent: (c: unknown) => { inserted.push(c); return chain; }, run: vi.fn() };
  return { editor: { chain: () => chain } as unknown as Editor, inserted, run: chain.run };
}
const attachment = (over: Partial<Attachment>): Attachment => ({ id: 'a1', name: 'file.pdf', size: 10, type: 'application/pdf', createdAt: new Date(0), ...over });

describe('insertAttachment', () => {
  it('puts a web link in as a link and reports it as stored', () => {
    const { editor, inserted, run } = fakeEditor();
    expect(insertAttachment(editor, attachment({ url: 'https://example.com/spec', name: 'Spec' }))).toBe(false);
    expect(inserted[0]).toEqual([
      { type: 'text', text: 'Spec', marks: [{ type: 'link', attrs: { href: 'https://example.com/spec' } }] },
      { type: 'text', text: ' ' },
    ]);
    expect(run).toHaveBeenCalled();
  });

  it('puts a stored picture in as an image tied to the attachment', () => {
    const { editor, inserted } = fakeEditor();
    expect(insertAttachment(editor, attachment({ type: 'image/png', dataUrl: 'data:image/png;base64,AAA', name: 'shot.png', id: 'p1' }))).toBe(false);
    expect(inserted[0]).toEqual({ type: 'image', attrs: { src: 'data:image/png;base64,AAA', alt: 'shot.png', attachmentId: 'p1' } });
  });

  it('puts a stored file in as a link that downloads it', () => {
    const { editor, inserted } = fakeEditor();
    expect(insertAttachment(editor, attachment({ dataUrl: 'data:application/pdf;base64,AAA', id: 'f9' }))).toBe(false);
    expect(JSON.stringify(inserted[0])).toContain('#attachment-f9');
  });

  it('keeps only the name of a file that was too big to store, and says so', () => {
    const { editor, inserted } = fakeEditor();
    expect(insertAttachment(editor, attachment({ dataUrl: undefined, id: 'big' }))).toBe(true);
    expect(JSON.stringify(inserted[0])).toContain('#attachment-big');
  });

  it('an image that was too big is treated like any other file that was too big', () => {
    const { editor } = fakeEditor();
    expect(insertAttachment(editor, attachment({ type: 'image/png', dataUrl: undefined }))).toBe(true);
  });
});

describe('screenshotName', () => {
  const file = (name: string, type: string) => new File(['x'], name, { type });

  it('gives a pasted "image.png" its own name from the time', () => {
    const named = screenshotName(file('image.png', 'image/png'));
    expect(named.name).toMatch(/^screenshot-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.png$/);
    expect(named.type).toBe('image/png');
  });

  it('turns jpeg into jpg in the new name', () => {
    expect(screenshotName(file('image.jpeg', 'image/jpeg')).name).toMatch(/\.jpg$/);
  });

  it('leaves files that already have a real name alone', () => {
    const f = file('diagram.png', 'image/png');
    expect(screenshotName(f)).toBe(f);
  });
});
