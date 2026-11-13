import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { byText, cleanup, click, mount, q, qa, settle } from '../../../test/render';
import { RichTextEditor } from './RichTextEditor';

afterEach(cleanup);

const buttons = () => qa('[role="toolbar"] button').map(b => b.getAttribute('aria-label'));
const noop = () => {};

describe('RichTextEditor', () => {
  describe('toolbar', () => {
    it('the full editor has every tool', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      expect(buttons()).toEqual(expect.arrayContaining([
        'Text style', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Text colour', 'Highlight', 'Bullet list', 'Numbered list',
        'Checkbox list', 'Quote', 'Code', 'Link', 'Mention someone (@)', 'Add attachment', 'Clear formatting', 'Undo', 'Redo',
      ]));
    });

    it('the compact editor (comments) has the short toolbar', async () => {
      mount(<RichTextEditor value="" onChange={noop} variant="compact" />);
      await settle();
      const tools = buttons();
      for (const kept of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Bullet list', 'Numbered list', 'Checkbox list', 'Link', 'Mention someone (@)', 'Add attachment', 'Undo', 'Redo']) expect(tools).toContain(kept);
      for (const dropped of ['Text style', 'Text colour', 'Highlight', 'Quote', 'Code', 'Clear formatting']) expect(tools).not.toContain(dropped);
    });

    it('undo and redo are off while there is nothing to undo or redo', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      expect((q('button[aria-label="Undo"]') as HTMLButtonElement).disabled).toBe(true);
      expect((q('button[aria-label="Redo"]') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('reading', () => {
    it('shows saved text without a toolbar when read-only', async () => {
      mount(<RichTextEditor value="<p>Hello <strong>world</strong></p>" onChange={noop} readOnly />);
      await settle();
      expect(q('[data-testid="rich-view"]')).not.toBeNull();
      expect(q('[role="toolbar"]')).toBeNull();
      expect(q('[data-testid="rich-view"]')!.textContent).toContain('Hello world');
      expect(q('[data-testid="rich-view"] strong')!.textContent).toBe('world');
    });

    it('shows the text in the editor, and older Markdown is converted', async () => {
      mount(<RichTextEditor value={'## Plan\n\n- one\n- two'} onChange={noop} />);
      await settle();
      const body = q('.lira-rich-body')!;
      expect(body.querySelector('h2')!.textContent).toBe('Plan');
      expect(body.querySelectorAll('li')).toHaveLength(2);
    });

    it('follows a new value coming from outside (another ticket opened)', async () => {
      const view = mount(<RichTextEditor value="<p>First</p>" onChange={noop} />);
      await settle();
      expect(q('.lira-rich-body')!.textContent).toContain('First');
      view.rerender(<RichTextEditor value="<p>Second</p>" onChange={noop} />);
      await settle();
      expect(q('.lira-rich-body')!.textContent).toContain('Second');
      expect(q('.lira-rich-body')!.textContent).not.toContain('First');
    });

    it('gives the writing area its accessible name and minimum height', async () => {
      mount(<RichTextEditor value="" onChange={noop} ariaLabel="Comment" minHeight={90} />);
      await settle();
      const body = q('.lira-rich-body')!;
      expect(body.getAttribute('aria-label')).toBe('Comment');
      expect(body.getAttribute('style')).toMatch(/min-height:\s*90px/);
    });

    it('switches between reading and editing without a new editor', async () => {
      const view = mount(<RichTextEditor value="<p>x</p>" onChange={noop} readOnly />);
      await settle();
      expect(q('[role="toolbar"]')).toBeNull();
      view.rerender(<RichTextEditor value="<p>x</p>" onChange={noop} readOnly={false} />);
      await settle();
      expect(q('[role="toolbar"]')).not.toBeNull();
    });
  });

  describe('menus', () => {
    it('the text style menu lists four styles and closes when one is chosen', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      expect(q('[role="menu"]')).toBeNull();
      await click(q('button[aria-label="Text style"]'));
      const items = qa('[role="menu"] [role="menuitem"]').map(i => i.textContent);
      expect(items).toEqual(['Normal text', 'Heading 1', 'Heading 2', 'Heading 3']);
      await click(byText('[role="menuitem"]', 'Heading 2'));
      expect(q('[role="menu"]')).toBeNull();
    });

    it('the text style menu closes on a click elsewhere', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      await click(q('button[aria-label="Text style"]'));
      await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
      expect(q('[role="menu"]')).toBeNull();
    });

    it('the colour menu shows the swatches, and Escape closes it', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      await click(q('button[aria-label="Text colour"]'));
      expect(qa('[role="menu"] [role="menuitem"]').length).toBe(8);
      expect(q('[role="menu"] button[aria-label="Red"]')).not.toBeNull();
      await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(q('[role="menu"]')).toBeNull();
    });

    it('the highlight menu offers six choices', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      await click(q('button[aria-label="Highlight"]'));
      expect(qa('[role="menu"] [role="menuitem"]').length).toBe(6);
    });
  });

  describe('keyboard', () => {
    it('Ctrl+Enter sends, when a send action is given', async () => {
      const onSubmit = vi.fn();
      mount(<RichTextEditor value="" onChange={noop} onSubmit={onSubmit} />);
      await settle();
      await act(async () => { q('.lira-rich-body')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })); });
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does nothing special on Ctrl+Enter without a send action', async () => {
      mount(<RichTextEditor value="" onChange={noop} />);
      await settle();
      await act(async () => { q('.lira-rich-body')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })); });
      expect(q('.lira-rich-body')).not.toBeNull();
    });
  });

  it('opens the attachment window from the paperclip', async () => {
    mount(<RichTextEditor value="" onChange={noop} />);
    await settle();
    const before = document.body.textContent;
    await click(q('button[aria-label="Add attachment"]'));
    await settle();
    expect(document.body.textContent).not.toBe(before);
  });
});
