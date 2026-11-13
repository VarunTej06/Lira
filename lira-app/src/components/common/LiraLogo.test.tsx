import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount, q } from '../../test/render';
import { LiraLogo } from './LiraLogo';

afterEach(cleanup);

const arrow = () => q<SVGPathElement>('[data-logo-arrow]')!.getAttribute('class') ?? '';

describe('LiraLogo', () => {
  it('is a picture named Lira, drawn in the page, with no image file', () => {
    mount(<LiraLogo />);
    expect(q('svg[role="img"]')!.getAttribute('aria-label')).toBe('Lira');
    expect(q('img')).toBeNull();
  });

  it('grows its arrow from the corner of the L on load, and again on hover', () => {
    mount(<LiraLogo />);
    expect(arrow()).toContain('[transform-origin:33px_36px]');
    expect(arrow()).toContain('animate-logo-grow');
    expect(arrow()).toContain('group-hover:animate-logo-grow-again');
  });

  it('keeps growing while the app starts, and can stand still', () => {
    mount(<LiraLogo motion="loop" />);
    expect(arrow()).toContain('animate-logo-grow-loop');
    cleanup();
    mount(<LiraLogo motion="none" />);
    expect(arrow()).not.toContain('animate-');
  });

  it('takes its size and the colour of the arrow from the caller', () => {
    mount(<LiraLogo className="w-16 h-16" accentClassName="stroke-lira-blue" />);
    expect(q('svg')!.getAttribute('class')).toBe('w-16 h-16');
    expect(arrow()).toContain('stroke-lira-blue');
  });
});
