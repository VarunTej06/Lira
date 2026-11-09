import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { AttachPicker } from './AttachPicker';
import { byText, cleanup, click, mount, press, q, qa, settle, typeInto, wait } from '../../test/render';

afterEach(cleanup);

const setup = async () => {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  mount(<AttachPicker open onClose={onClose} onAdd={onAdd} />);
  await settle();
  return { onAdd, onClose };
};
const source = (name: string) => byText('[data-testid=attach-picker] nav button', new RegExp(name))!;
const confirm = () => q<HTMLButtonElement>('[data-testid=attach-confirm]')!;

describe('Attach window', () => {
  it('offers the five places a file can come from', async () => {
    await setup();
    const names = qa('[data-testid=attach-picker] nav button').map(b => b.textContent);
    for (const n of ['My computer', 'Google Drive', 'OneDrive', 'Dropbox', 'Web link']) expect(names.some(t => t?.includes(n))).toBe(true);
  });

  it('cannot attach until a file or a link has been chosen', async () => {
    await setup();
    expect(confirm().disabled).toBe(true);
    await click(source('Google Drive'));
    expect(confirm().disabled).toBe(true);
  });

  it('adds a Google Drive share link with the name the person gave it', async () => {
    const { onAdd, onClose } = await setup();
    await click(source('Google Drive'));
    await typeInto(q<HTMLInputElement>('#attach-url'), 'https://drive.google.com/file/d/abc/view');
    await typeInto(q<HTMLInputElement>('#attach-name'), 'Design spec');
    await click(confirm());
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [item] = onAdd.mock.calls[0][0];
    expect(item).toMatchObject({ name: 'Design spec', url: 'https://drive.google.com/file/d/abc/view', source: 'drive', size: 0 });
    expect(onClose).toHaveBeenCalled();
  });

  it('names a link after its site when no name is given, and adds https:// when it is missing', async () => {
    const { onAdd } = await setup();
    await click(source('Web link'));
    await typeInto(q<HTMLInputElement>('#attach-url'), 'www.example.com/spec');
    await click(confirm());
    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ name: 'example.com', url: 'https://www.example.com/spec', source: 'link' });
  });

  it('refuses addresses that are not web addresses', async () => {
    await setup();
    await click(source('Web link'));
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'not a url at all']) {
      await typeInto(q<HTMLInputElement>('#attach-url'), bad);
      expect(confirm().disabled, bad).toBe(true);
      expect(q('[data-testid=attach-picker]')!.textContent).toContain('not a web address');
    }
  });

  it('stages files from this computer, shows their size, lets one be removed, then attaches them with their contents', async () => {
    const { onAdd } = await setup();
    const input = q<HTMLInputElement>('[data-testid=attach-file-input]')!;
    const files = [new File(['hello'], 'notes.txt', { type: 'text/plain' }), new File(['abc'], 'b.txt', { type: 'text/plain' })];
    await act(async () => {
      Object.defineProperty(input, 'files', { value: files, configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(0);
    });
    expect(qa('[aria-label="Files to attach"] li')).toHaveLength(2);
    expect(q('[aria-label="Files to attach"]')!.textContent).toContain('5 B');
    await click(q('[aria-label="Remove b.txt"]'));
    expect(qa('[aria-label="Files to attach"] li')).toHaveLength(1);
    await click(confirm());
    await settle();
    const items = onAdd.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'notes.txt', size: 5, type: 'text/plain' });
    expect(items[0].dataUrl).toContain('data:text/plain');
  });

  it('Escape and Cancel close it without adding anything', async () => {
    const { onAdd, onClose } = await setup();
    await press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    await click(byText('button', 'Cancel'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
