import { afterEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, mount, q, qa } from '../../../test/render';
import type { Space } from '../../../types/space';
import { Collapsible, ContextItem, FloatingMenu, RowMenuButton, SectionHeader, SpaceRow } from './parts';

afterEach(cleanup);

const space = { id: 3, key: 'AAA', name: 'Alpha', icon: 'A', color: '#aa5500' } as Space;
type RowProps = Parameters<typeof SpaceRow>[0];

function row(over: Partial<RowProps> = {}) {
  const h = { onSelect: vi.fn(), onMenuOpen: vi.fn(), onStar: vi.fn(), onDelete: vi.fn(), onEdit: vi.fn(), onToggleHide: vi.fn(), onToggleArchive: vi.fn() };
  mount(<SpaceRow space={space} active={false} starred={false} menuOpen={false} {...h} {...over} />);
  return h;
}
const item = (label: string) => byText('button', label)!;

describe('SpaceRow', () => {
  it('shows the icon and name and selects the space on click', async () => {
    const h = row();
    expect(document.body.textContent).toContain('Alpha');
    await click(q('button[data-menu-trigger]')!.previousElementSibling);
    expect(h.onSelect).toHaveBeenCalledWith(3);
  });
  it('draws the space icon on a tile tinted with the space colour', () => {
    row();
    const icon = qa('div').find(d => d.querySelector(':scope > svg[data-space-icon]') && d.getAttribute('style'))!;
    expect(icon.getAttribute('style')).toContain('background-color');
    expect(icon.getAttribute('style')).toContain('170, 85, 0');
  });
  it('marks the open space', () => {
    row({ active: true });
    expect(q('[data-active="true"]')!.className).toContain('text-white font-medium');
    cleanup();
    row();
    expect(q('[data-active]')).toBeNull();
  });
  it('shows the hidden, archived and starred marks only when they apply', () => {
    row();
    expect(q('[title="Hidden space"]')).toBeNull();
    expect(q('[title="Archived space"]')).toBeNull();
    expect(q('svg.text-yellow-400')).toBeNull();
    cleanup();
    row({ isHidden: true, isArchived: true, starred: true });
    expect(q('[title="Hidden space"]')).not.toBeNull();
    expect(q('[title="Archived space"]')).not.toBeNull();
    expect(q('svg.text-yellow-400')).not.toBeNull();
  });
  it('styles the name by state: hidden dimmer, archived italic', () => {
    row({ isHidden: true });
    expect(byText('span', 'Alpha')!.className).toContain('text-white/50');
    cleanup();
    row({ isArchived: true });
    expect(byText('span', 'Alpha')!.className).toContain('italic');
  });
  it('opens the menu from the ... button without selecting the space', async () => {
    const h = row();
    const trigger = q('button[data-menu-trigger]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await click(trigger);
    expect(h.onMenuOpen).toHaveBeenCalled();
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  describe('menu', () => {
    it('is closed unless asked to be open', () => {
      row();
      expect(byText('button', 'Space settings')).toBeUndefined();
    });
    it('has the standard items and runs star, edit and delete', async () => {
      const h = row({ menuOpen: true });
      for (const l of ['Add to starred', 'Space settings', 'Set space background', 'Add people', 'Save as template', 'Hide space', 'Archive space', 'Delete space']) expect(item(l)).toBeDefined();
      await click(item('Add to starred')); await click(item('Space settings')); await click(item('Delete space'));
      expect(h.onStar).toHaveBeenCalled(); expect(h.onEdit).toHaveBeenCalled(); expect(h.onDelete).toHaveBeenCalled();
    });
    it('has the placeholder items do nothing', async () => {
      const h = row({ menuOpen: true });
      await click(item('Set space background')); await click(item('Add people')); await click(item('Save as template'));
      expect(Object.values(h).every(f => f.mock.calls.length === 0)).toBe(true);
    });
    it('says what the state allows: remove from starred, unhide, unarchive', async () => {
      const h = row({ menuOpen: true, starred: true, isHidden: true, isArchived: true });
      expect(item('Remove from starred')).toBeDefined();
      await click(item('Unhide space')); await click(item('Unarchive space'));
      expect(h.onToggleHide).toHaveBeenCalled(); expect(h.onToggleArchive).toHaveBeenCalled();
    });
    it('leaves out hide and archive when they are not offered', () => {
      row({ menuOpen: true, onToggleHide: undefined, onToggleArchive: undefined });
      expect(byText('button', /Hide space|Archive space/)).toBeUndefined();
    });
    it('is drawn in the page body, not inside the row', () => {
      row({ menuOpen: true });
      expect(q('[data-floating]')!.parentElement).toBe(document.body);
    });
  });
});

describe('FloatingMenu', () => {
  const anchored = (menu: Partial<{ top: number; bottom: number; right: number }> = {}) => {
    const host = document.createElement('div');
    host.setAttribute('data-menu-root', 'x');
    const trigger = document.createElement('button');
    trigger.setAttribute('data-menu-trigger', '');
    trigger.getBoundingClientRect = () => ({ top: 100, bottom: 120, right: 300, left: 280, width: 20, height: 20, x: 280, y: 100, toJSON() {} }) as DOMRect;
    Object.assign(trigger, menu);
    host.appendChild(trigger);
    document.body.appendChild(host);
  };
  const menu = () => q('[data-floating]')!;

  it('opens under the button, right-aligned to it, once placed', () => {
    anchored();
    const proto = HTMLElement.prototype;
    Object.defineProperty(proto, 'offsetWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get: () => 100 });
    mount(<FloatingMenu menuRoot="x" onClose={() => {}}><span>hi</span></FloatingMenu>);
    expect(menu().style.visibility).toBe('visible');
    expect(menu().style.top).toBe('124px');
    expect(menu().style.left).toBe('100px');
    delete (proto as unknown as Record<string, unknown>).offsetWidth;
    delete (proto as unknown as Record<string, unknown>).offsetHeight;
  });
  it('stays hidden when there is no button to anchor to', () => {
    mount(<FloatingMenu menuRoot="nope" onClose={() => {}}><span>hi</span></FloatingMenu>);
    expect(menu().style.visibility).toBe('hidden');
  });
  it('closes on a scroll elsewhere and on resize, but not on a scroll inside it', () => {
    const onClose = vi.fn();
    mount(<FloatingMenu menuRoot="nope" onClose={onClose}><span>hi</span></FloatingMenu>);
    menu().dispatchEvent(new Event('scroll'));
    expect(onClose).not.toHaveBeenCalled();
    document.body.dispatchEvent(new Event('scroll'));
    expect(onClose).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('does not pass clicks on to the row it belongs to', () => {
    const behind = vi.fn();
    mount(<div onClick={behind}><FloatingMenu menuRoot="nope" onClose={() => {}}><span>hi</span></FloatingMenu></div>);
    menu().click();
    expect(behind).not.toHaveBeenCalled();
  });
});

describe('RowMenuButton', () => {
  it('opens and closes through the toggle, and lists the items when open', async () => {
    const onToggle = vi.fn();
    mount(<RowMenuButton open={false} onToggle={onToggle} label="Sprint actions" menuKey="k"><span>items</span></RowMenuButton>);
    await click(q('button[aria-label="Sprint actions"]'));
    expect(onToggle).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('items');
    cleanup();
    mount(<RowMenuButton open onToggle={onToggle} label="Sprint actions" menuKey="k"><span>items</span></RowMenuButton>);
    expect(q('button[aria-label="Sprint actions"]')!.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('items');
  });
});

describe('ContextItem', () => {
  it('shows the label and runs the click; danger is red', async () => {
    const onClick = vi.fn();
    mount(<ContextItem icon={<i />} label="Go" onClick={onClick} />);
    await click(item('Go'));
    expect(onClick).toHaveBeenCalled();
    expect(item('Go').className).toContain('text-white/70');
    cleanup();
    mount(<ContextItem icon={<i />} label="Go" onClick={onClick} danger />);
    expect(item('Go').className).toContain('text-red-400');
  });
});

describe('SectionHeader', () => {
  it('shows the title and count, and toggles', async () => {
    const onToggle = vi.fn();
    mount(<SectionHeader title="Spaces" count={4} expanded onToggle={onToggle} addTitle="New space" />);
    expect(document.body.textContent).toContain('Spaces');
    expect(document.body.textContent).toContain('4');
    const b = q('button[title="Minimise Spaces"]')!;
    expect(b.getAttribute('aria-expanded')).toBe('true');
    await click(b);
    expect(onToggle).toHaveBeenCalled();
  });
  it('says Expand when collapsed, and has a + only when it can add', async () => {
    const onAdd = vi.fn();
    mount(<SectionHeader title="Spaces" count={0} expanded={false} onToggle={() => {}} addTitle="New space" />);
    expect(q('button[title="Expand Spaces"]')).not.toBeNull();
    expect(q('button[aria-label="New space"]')).toBeNull();
    cleanup();
    mount(<SectionHeader title="Spaces" count={0} expanded onToggle={() => {}} onAdd={onAdd} addTitle="New space" />);
    await click(q('button[aria-label="New space"]'));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('Collapsible', () => {
  it('shows the content open, and hides it from assistive tech when closed', () => {
    mount(<Collapsible open><span>body</span></Collapsible>);
    expect(q('[aria-hidden="false"]')!.className).toContain('grid-rows-[1fr]');
    cleanup();
    mount(<Collapsible open={false}><span>body</span></Collapsible>);
    expect(q('[aria-hidden="true"]')!.className).toContain('grid-rows-[0fr]');
  });
});
