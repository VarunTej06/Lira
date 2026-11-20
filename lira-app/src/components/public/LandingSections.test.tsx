import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, click, cleanup, mount, q, qa, settle } from '../../test/render';
import { BASE_ALPHA } from '../../utils/dotField';
import { PointerDots } from './PointerDots';
import { PublicSite } from './PublicSite';
import { DISCOVER_CARDS } from './discoverContent';

type Callback = (entries: { isIntersecting: boolean }[]) => void;
const watchers = new Map<Element, Callback>();
/** Tells the page that an element came into view (or left it), as the browser would. */
const scrollTo = (el: Element, isIntersecting: boolean) => act(() => watchers.get(el)!([{ isIntersecting }]));

beforeEach(() => {
  watchers.clear();
  class FakeObserver { cb: Callback; constructor(cb: Callback) { this.cb = cb; } observe(el: Element) { watchers.set(el, this.cb); } disconnect() {} }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function landing() {
  mount(<MemoryRouter initialEntries={['/']}><PublicSite /></MemoryRouter>);
  await settle(400);
}
const text = () => document.body.textContent ?? '';

describe('landing page sections', () => {
  it('has every section of the reference, in order', async () => {
    await landing();
    const headings = qa('h1, h2').map(h => h.textContent!.replace(/\s+/g, ' ').trim());
    const wanted = ['Everything you are working on', 'What is inside', 'More than project management', 'Liraspaces is better with documents and files',
      'Liraspaces for the AI era', 'Discover the latest', 'Your data', 'Plan, learn and deliver in Liraspaces'];
    const at = wanted.map(w => headings.findIndex(h => h.startsWith(w)));
    expect(at.every(i => i >= 0), JSON.stringify(headings)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('shows the three features of "More than project management" as alternating rows with a picture each', async () => {
    await landing();
    const section = q('[aria-labelledby="more-title"]')!;
    expect(qa('h3', section).map(h => h.textContent)).toEqual(['Search', 'Viva', 'Roadmaps and dashboards']);
    expect(qa('[role="img"]', section)).toHaveLength(3);
    expect(section.querySelectorAll('.md\\:order-2')).toHaveLength(1);
  });

  it('lists what a space includes, and has no pricing link', async () => {
    await landing();
    const section = q('[aria-labelledby="files-title"]')!;
    expect(qa('li', section).map(li => li.textContent!.slice(1))).toEqual(['Boards', 'Sprints', 'Roadmaps', 'Dashboards', 'Documents', 'Forms', 'Viva']);
    expect(byText('a', 'Try them all free', section)!.getAttribute('href')).toBe('/signup');
    expect(text()).not.toMatch(/pricing/i);
  });

  it('has a large footer with product, resources and legal links, and only links that lead somewhere', async () => {
    await landing();
    const footer = q('footer')!;
    expect(qa('nav', footer).map(n => n.getAttribute('aria-label'))).toEqual(['PRODUCT', 'RESOURCES', 'LEGAL']);
    expect(byText('a', 'Contact us', footer)!.getAttribute('href')).toMatch(/^mailto:/);
    expect(footer.textContent).not.toMatch(/Careers|Investor|Press kit|Marketplace|Partners/);
    for (const a of qa<HTMLAnchorElement>('a', footer)) expect(a.getAttribute('href'), a.textContent!).toMatch(/^(\/|mailto:)/);
  });

  it('ends with a black closing band whose button leads to sign-up', async () => {
    await landing();
    const band = q('[aria-labelledby="closing-title"]')!;
    expect(band.className).toContain('bg-black');
    expect(byText('a', 'Get Liraspaces free', band)!.getAttribute('href')).toBe('/signup');
    expect(band.textContent).toContain('No credit card required');
  });
});

describe('black AI and MCP band', () => {
  it('is black in every theme, with the headline, the typing line and its caret', async () => {
    await landing();
    const band = q('[aria-labelledby="ai-title"]')!;
    expect(band.className).toContain('bg-black');
    expect(q('#ai-title')!.textContent).toContain('Liraspaces for the AI era');
    expect(q('#ai-title')!.textContent).toContain('connect anywhere');
    expect(q('#ai-title .animate-caret')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('types only the word "anywhere", and types it again each time the band scrolls into view', async () => {
    await landing();
    const word = () => q('#ai-title [data-typing]')!;
    expect(word().textContent).toBe('anywhere');
    expect(word().className).not.toContain('animate-typing');
    scrollTo(q('#ai-title')!, true);
    expect(word().className).toContain('animate-typing');
    scrollTo(q('#ai-title')!, false);
    expect(word().className).not.toContain('animate-typing');
    scrollTo(q('#ai-title')!, true);
    expect(word().className).toContain('animate-typing');
  });

  it('claims only what is true: one MCP chip marked coming soon, no other tool names, two columns marked coming soon', async () => {
    await landing();
    const band = q('[aria-labelledby="ai-title"]')!;
    expect(band.textContent).toContain('WORKS WITH');
    expect(band.textContent).toContain('Any MCP agent');
    expect(band.textContent).not.toMatch(/Claude|Cursor|Codex|Copilot/);
    expect(qa('span', band).filter(s => s.textContent === 'COMING SOON')).toHaveLength(2);
    expect(qa('h3', band).map(h => h.textContent)).toEqual(['Viva inside your workflow', 'An MCP server', 'Every change on record']);
  });

  it('draws three dot icons and a pointer canvas that is hidden from screen readers', async () => {
    await landing();
    const band = q('[aria-labelledby="ai-title"]')!;
    expect(qa('svg[aria-hidden="true"]', band).filter(s => s.querySelectorAll('circle').length > 5)).toHaveLength(3);
    expect(q('canvas', band)!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('PointerDots', () => {
  function withCanvas(quiet: boolean) {
    const alphas: number[] = [];
    const ctx = {
      clearRect() {}, beginPath() {}, fill() {},
      arc() { alphas.push(ctx.globalAlpha); },
      globalAlpha: 1, fillStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: quiet && query.includes('reduce'), media: query }));
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 220 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 110 });
    const view = mount(<div id="host"><PointerDots /></div>);
    const flush = () => act(() => { frames.splice(0).forEach(f => f()); });
    return { alphas, host: q('#host')!, view, flush };
  }

  it('rests faint, and lights the dots next to the mouse', () => {
    const { alphas, host, flush } = withCanvas(false);
    expect(alphas.length).toBeGreaterThan(10);
    expect(Math.max(...alphas)).toBeCloseTo(BASE_ALPHA);
    alphas.length = 0;
    act(() => { host.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true })); });
    flush();
    expect(Math.max(...alphas)).toBeGreaterThan(0.8);
    alphas.length = 0;
    act(() => { host.dispatchEvent(new MouseEvent('pointerleave')); });
    flush();
    expect(Math.max(...alphas)).toBeCloseTo(BASE_ALPHA);
  });

  it('stays still when the person asked for less motion', () => {
    const { alphas, host, flush } = withCanvas(true);
    alphas.length = 0;
    act(() => { host.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true })); });
    flush();
    expect(alphas).toHaveLength(0);
  });
});

describe('Discover the latest', () => {
  const list = () => q<HTMLUListElement>('[aria-labelledby="discover-title"] ul')!;

  it('has one card for each real change, with the unbuilt ones marked coming soon', async () => {
    await landing();
    const cards = qa('li', list());
    expect(cards).toHaveLength(DISCOVER_CARDS.length);
    expect(cards.filter(c => c.textContent!.includes('COMING SOON'))).toHaveLength(2);
    expect(list().textContent).not.toMatch(/VIDEO|EBOOK|REPORT/);
  });

  it('slides in from the right every time the row comes into view, and resets when it leaves', async () => {
    await landing();
    const row = () => list().parentElement!;
    expect(row().className).toContain('translate-x-24');
    expect(row().className).toContain('opacity-0');
    scrollTo(row(), true);
    expect(row().className).toContain('translate-x-0');
    expect(row().className).toContain('opacity-100');
    scrollTo(row(), false);
    expect(row().className).toContain('translate-x-24');
    scrollTo(row(), true);
    expect(row().className).toContain('translate-x-0');
  });

  it('scrolls a card at a time with the arrows, and switches each arrow off at its end', async () => {
    await landing();
    const scrollBy = vi.fn();
    list().scrollBy = scrollBy;
    const prev = () => q<HTMLButtonElement>('button[aria-label="Previous cards"]')!;
    const next = () => q<HTMLButtonElement>('button[aria-label="Next cards"]')!;
    expect(prev().disabled).toBe(true);
    expect(next().disabled).toBe(false);
    await click(next());
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);

    for (const [prop, value] of [['clientWidth', 400], ['scrollWidth', 1200], ['scrollLeft', 800]] as const) Object.defineProperty(list(), prop, { configurable: true, value });
    act(() => { list().dispatchEvent(new Event('scroll')); });
    expect(next().disabled).toBe(true);
    expect(prev().disabled).toBe(false);
  });

  it('scrolls without animation when the person asked for less motion', async () => {
    await landing();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    const scrollBy = vi.fn();
    list().scrollBy = scrollBy;
    await click(q('button[aria-label="Next cards"]'));
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });
});

describe('email bar focus', () => {
  it('puts the focus ring around the whole bar, so it never touches the button', async () => {
    await landing();
    const input = q<HTMLInputElement>('#hero-email')!;
    expect(input.className).toContain('outline-none');
    expect(input.parentElement!.className).toContain('focus-within:outline');
    expect(input.parentElement!.className).toContain('gap-2');
  });
});
