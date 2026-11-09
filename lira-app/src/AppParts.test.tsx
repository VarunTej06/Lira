import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q } from './test/render';
import { IssueCrashFallback, StartupScreen } from './AppParts';

afterEach(cleanup);

describe('StartupScreen', () => {
  it('shows the logo and says Lira is starting', () => {
    mount(<StartupScreen />);
    expect(q('img[alt="Lira Logo"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Initializing Lira');
  });
});

describe('IssueCrashFallback', () => {
  it('says the issue could not be drawn', () => {
    mount(<IssueCrashFallback onClose={() => {}} />);
    expect(document.body.textContent).toContain('Failed to render this issue');
  });
  it('closes from the button and from the backdrop', async () => {
    const onClose = vi.fn();
    mount(<IssueCrashFallback onClose={onClose} />);
    await click(byText('button', 'Close'));
    expect(onClose).toHaveBeenCalled();
    await click(q('.fixed'));
    expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
