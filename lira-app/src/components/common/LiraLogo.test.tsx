import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount, q, qa } from '../../test/render';
import { LiraLogo } from './LiraLogo';

afterEach(cleanup);

const pages = () => qa<SVGGElement>('[data-logo-page]').map((g) => g.getAttribute('class') ?? '');

describe('LiraLogo', () => {
  it('is a picture named Liraspaces, drawn in the page, with no image file', () => {
    mount(<LiraLogo />);
    expect(q('svg[role="img"]')!.getAttribute('aria-label')).toBe('Liraspaces');
    expect(q('img')).toBeNull();
  });

  it('settles the left page, then the right, on load, and again on hover', () => {
    mount(<LiraLogo />);
    const [left, right] = pages();
    expect(left).toContain('animate-logo-settle');
    expect(left).toContain('group-hover:animate-logo-settle-again');
    expect(left).toContain('[animation-delay:0s]');
    expect(right).toContain('[animation-delay:0.3s]');
  });

  it('keeps moving while the app starts, can stand still, and respects reduced motion', () => {
    mount(<LiraLogo motion="loop" />);
    expect(pages().every((c) => c.includes('animate-logo-settle-loop'))).toBe(true);
    cleanup();
    mount(<LiraLogo motion="none" />);
    expect(pages().every((c) => !c.includes('animate-logo') && !c.includes('animation-delay'))).toBe(true);
    expect(pages().every((c) => c.includes('motion-reduce:animate-none'))).toBe(true);
  });

  it('takes its size and the colour of the book from the caller, and the hexagon from the text colour', () => {
    mount(<LiraLogo className="w-16 h-16" accentClassName="fill-lira-blue" />);
    expect(q('svg')!.getAttribute('class')).toBe('w-16 h-16');
    expect(pages().every((c) => c.includes('fill-lira-blue'))).toBe(true);
    expect(q('svg > path')!.getAttribute('class')).toBe('fill-current');
  });
});
