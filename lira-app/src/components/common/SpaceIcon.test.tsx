import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, click, mount, q, qa } from '../../test/render';
import { SPACE_ICON_KEYS } from '../../utils/spaceIcon';
import { SpaceIcon, SpaceIconPicker } from './SpaceIcon';

afterEach(cleanup);

const drawn = () => q('svg[data-space-icon]')?.getAttribute('data-space-icon');

describe('SpaceIcon', () => {
  it('draws a line icon, never the saved text', () => {
    mount(<SpaceIcon icon="rocket" />);
    expect(drawn()).toBe('rocket');
    expect(document.body.textContent).toBe('');
  });

  it('draws the matching icon for an older emoji, and a folder for anything else', () => {
    mount(<SpaceIcon icon={'\u{1F3C6}'} />);
    expect(drawn()).toBe('trophy');
    cleanup();
    mount(<SpaceIcon icon="<b>x</b>" />);
    expect(drawn()).toBe('folder');
    expect(document.body.textContent).toBe('');
  });

  it('takes the size it is given', () => {
    mount(<SpaceIcon icon="globe" className="w-6 h-6" />);
    expect(q('svg[data-space-icon]')!.getAttribute('class')).toContain('w-6 h-6');
  });
});

describe('SpaceIconPicker', () => {
  it('offers every icon and marks the chosen one', () => {
    mount(<SpaceIconPicker value="target" onChange={vi.fn()} />);
    expect(qa('button[aria-pressed]')).toHaveLength(SPACE_ICON_KEYS.length);
    expect(qa('button[aria-pressed="true"]').map(b => b.getAttribute('aria-label'))).toEqual(['target']);
  });

  it('marks the matching icon when the space still has an older emoji', () => {
    mount(<SpaceIconPicker value={'\u{1F680}'} onChange={vi.fn()} />);
    expect(q('button[aria-pressed="true"]')!.getAttribute('aria-label')).toBe('rocket');
  });

  it('reports the name of the icon that is clicked', async () => {
    const onChange = vi.fn();
    mount(<SpaceIconPicker value="folder" onChange={onChange} />);
    await click(q('button[aria-label="shield"]'));
    expect(onChange).toHaveBeenCalledWith('shield');
  });
});
