import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa, settle } from '../../../test/render';
import { currentRequest } from '../dialogStore';
import { RichTextEditor } from './RichTextEditor';

vi.mock('../../../utils/edition', () => ({ isHosted: () => true }));
afterEach(cleanup);

describe('rich text in the hosted edition', () => {
  it('has no attach button, because files kept inside the text would only live in the browser', async () => {
    mount(<RichTextEditor value="" onChange={() => undefined} />);
    await settle();
    expect(qa('[role="toolbar"] button').map(b => b.getAttribute('aria-label'))).not.toContain('Add attachment');
    expect(qa('[role="toolbar"] button').map(b => b.getAttribute('aria-label'))).toContain('Bold');
  });

  it('adds nothing when a file is pasted, and says where to add files instead', async () => {
    const onAttachments = vi.fn();
    const onChange = vi.fn();
    mount(<RichTextEditor value="" onChange={onChange} onAttachmentsChange={onAttachments} />);
    await settle();
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    paste.clipboardData = { files: [file], items: [], getData: () => '', types: ['Files'] };
    await act(async () => { q('[role="textbox"]')!.dispatchEvent(paste); });
    await settle(30);
    expect(onAttachments).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(currentRequest()).toMatchObject({ title: 'Add files as attachments' });
  });
});
