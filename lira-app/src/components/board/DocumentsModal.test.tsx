import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Space } from '../../types/space';
import { byText, cleanup, click, mount, q, qa, settle, typeInto, wait } from '../../test/render';
import { appStorage } from '../../utils/appStorage';

const h = vi.hoisted(() => ({ confirm: vi.fn(), saved: vi.fn() }));
vi.mock('../common/dialogStore', () => ({ confirmDialog: h.confirm }));
vi.mock('../common/savedToastStore', () => ({ notifySaved: h.saved }));

import { DocumentsModal } from './DocumentsModal';

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); h.confirm.mockResolvedValue(true); });
afterEach(cleanup);

const space = { id: 3, key: 'AAA', name: 'Alpha' } as Space;
const KEY = 'lira_docs_3';

function show(over: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  mount(<DocumentsModal isOpen onClose={onClose} space={space} {...over} />);
  return onClose;
}
const area = () => q<HTMLTextAreaElement>('#docs-textarea')!;
const btn = (t: string | RegExp) => byText('button', t)!;
const saveButtons = () => qa('button').filter(b => b.textContent === 'Save');

describe('DocumentsModal', () => {
  describe('loading', () => {
    it('is empty while closed', () => {
      mount(<DocumentsModal isOpen={false} onClose={() => {}} space={space} />);
      expect(q('#docs-textarea')).toBeNull();
    });
    it('shows the template with the space name the first time, and stores it', () => {
      show();
      expect(area().value).toContain('Welcome to the project documentation space for **Alpha**');
      expect(appStorage.get(KEY)).toBe(area().value);
    });
    it('uses Workspace as the name without a space, and a shared key', () => {
      show({ space: undefined });
      expect(area().value).toContain('**Workspace**');
      expect(document.body.textContent).toContain('Documents & Notes · Workspace');
      expect(document.body.textContent).toContain('lira_docs_global');
    });
    it('shows saved notes instead of the template', () => {
      appStorage.set(KEY, 'my notes');
      show();
      expect(area().value).toBe('my notes');
    });
    it('starts as saved', () => {
      show();
      expect(document.body.textContent).toContain('Saved');
      expect(document.body.textContent).not.toContain('Unsaved changes');
    });
  });

  describe('editing and saving', () => {
    it('says Unsaved changes after typing, and counts words and characters', async () => {
      appStorage.set(KEY, '');
      show();
      await typeInto(area(), 'one two  three');
      expect(document.body.textContent).toContain('Unsaved changes');
      expect(document.body.textContent).toContain('3 words');
      expect(document.body.textContent).toContain('14 characters');
    });
    it('counts 0 words for empty text', () => {
      appStorage.set(KEY, '   ');
      show();
      expect(document.body.textContent).toContain('0 words');
    });
    it('saves with the Save button, shows a saved card with the time, and closes', async () => {
      const onClose = show();
      await typeInto(area(), 'changed');
      await click(saveButtons()[0]);
      expect(appStorage.get(KEY)).toBe('changed');
      expect(h.saved).toHaveBeenCalledWith('Document saved');
      expect(onClose).toHaveBeenCalled();
    });
    it('just closes without claiming a save when nothing changed', async () => {
      const onClose = show();
      await click(saveButtons()[0]);
      expect(h.saved).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
    it('saves with Ctrl+S without closing', async () => {
      const onClose = show();
      await typeInto(area(), 'changed');
      await act(async () => { area().dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); await wait(0); });
      expect(appStorage.get(KEY)).toBe('changed');
      expect(onClose).not.toHaveBeenCalled();
      expect(document.body.textContent).toMatch(/Saved at/);
    });
    it('closes with Done', async () => {
      const onClose = show();
      await click(btn('Done'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('formatting buttons', () => {
    const typeAndSelect = async (text: string, start: number, end: number) => {
      await typeInto(area(), text);
      area().setSelectionRange(start, end);
    };
    it('wrap the selected text', async () => {
      show();
      await typeAndSelect('hello world', 6, 11);
      await click(q('button[title="Bold"]'));
      expect(area().value).toBe('hello **world**');
    });
    it('wrap the word "text" when nothing is selected', async () => {
      show();
      await typeAndSelect('', 0, 0);
      await click(q('button[title="Italic"]'));
      expect(area().value).toBe('*text*');
    });
    it('add prefixes and code fences', async () => {
      show();
      await typeAndSelect('item', 0, 4);
      await click(q('button[title="Checklist Item"]'));
      expect(area().value).toBe('- [ ] item');
      await typeAndSelect('x', 0, 1);
      await click(q('button[title="Code Block"]'));
      expect(area().value).toBe('```\nx\n```');
      await typeAndSelect('t', 0, 1);
      await click(q('button[title="Heading"]'));
      expect(area().value).toBe('## t');
      await typeAndSelect('b', 0, 1);
      await click(q('button[title="Bullet List"]'));
      expect(area().value).toBe('- b');
    });
    it('mark the document as changed', async () => {
      show();
      await click(q('button[title="Bold"]'));
      expect(document.body.textContent).toContain('Unsaved changes');
      await settle(30);
    });
  });

  describe('actions', () => {
    it('copies the text and says Copied!', async () => {
      const writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });
      show();
      await click(q('button[title="Copy markdown text"]'));
      expect(writeText).toHaveBeenCalledWith(area().value);
      expect(document.body.textContent).toContain('Copied!');
    });
    it('exports a Markdown file named after the space', async () => {
      const create = vi.fn(() => 'blob:x');
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
      const names: string[] = [];
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { names.push(this.download); };
      show();
      await click(q('button[title="Export as Markdown (.md)"]'));
      HTMLAnchorElement.prototype.click = orig;
      expect(names).toEqual(['AAA-docs.md']);
    });
    it('resets to the template only after a yes, and saves it', async () => {
      appStorage.set(KEY, 'mine');
      show();
      h.confirm.mockResolvedValueOnce(false);
      await click(q('button[title="Reset note"]'));
      expect(area().value).toBe('mine');
      await click(q('button[title="Reset note"]'));
      expect(area().value).toContain('Welcome to the project documentation space');
      expect(appStorage.get(KEY)).toBe(area().value);
    });
  });

  describe('preview', () => {
    const preview = async (text: string) => {
      appStorage.set(KEY, text);
      show();
      await click(btn(/Preview Document/));
    };
    it('has no toolbar in preview', async () => {
      await preview('x');
      expect(q('button[title="Bold"]')).toBeNull();
      expect(q('#docs-textarea')).toBeNull();
    });
    it('draws headings, bullets, numbers, checklists and paragraphs', async () => {
      await preview('# One\n## Two\n### Three\n- bullet\n* star\n1. first\n- [x] done\n- [ ] todo\nplain\n');
      expect(qa('h1').map(h => h.textContent)).toContain('One');
      expect(qa('h2').map(h => h.textContent)).toContain('Two');
      expect(q('h3')!.textContent).toBe('Three');
      expect(qa('li.list-disc').map(l => l.textContent)).toEqual(['bullet', 'star']);
      expect(q('li.list-decimal')!.textContent).toBe('first');
      const boxes = qa<HTMLInputElement>('input[type="checkbox"]');
      expect(boxes.map(b => b.checked)).toEqual([true, false]);
      expect(q('div.line-through')!.textContent).toBe('done');
      expect(byText('p', 'plain')).toBeDefined();
    });
    it('says so when the document is empty', async () => {
      await preview('   ');
      expect(document.body.textContent).toContain('This document is empty.');
    });
    it('switches back to the editor', async () => {
      await preview('x');
      await click(btn(/Markdown Editor/));
      expect(area().value).toBe('x');
    });
  });
});
