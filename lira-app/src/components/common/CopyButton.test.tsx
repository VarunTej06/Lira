import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';
import { copyText } from './copyText';
import { cleanup, click, mount, q, settle } from '../../test/render';

const clipboard = { writeText: vi.fn() };
beforeEach(() => {
  clipboard.writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
});
afterEach(cleanup);

describe('copyText', () => {
  it('copies the text and says it worked', async () => {
    expect(await copyText('hello')).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('reports a failure when nothing can copy', async () => {
    clipboard.writeText = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await copyText('x')).toBe(false); // and the older way is not there in this fake browser
  });
});

describe('Copy button', () => {
  it('reads the text when pressed (so it copies what is shown now) and shows "Copied"', async () => {
    let text = 'first';
    mount(<CopyButton label="Copy comment" getText={() => text} />);
    expect(q('[data-testid=copy-button]')!.getAttribute('aria-label')).toBe('Copy comment');
    text = 'second';
    await click(q('[data-testid=copy-button]'));
    expect(clipboard.writeText).toHaveBeenCalledWith('second');
    expect(q('[data-testid=copy-button]')!.getAttribute('aria-label')).toBe('Copied');
    await settle(1700);
    expect(q('[data-testid=copy-button]')!.getAttribute('aria-label')).toBe('Copy comment');
  });

  it('does not run the click of the row around it', async () => {
    const onRow = vi.fn();
    mount(<div onClick={onRow}><CopyButton getText={() => 'x'} /></div>);
    await click(q('[data-testid=copy-button]'));
    expect(onRow).not.toHaveBeenCalled();
  });
});
