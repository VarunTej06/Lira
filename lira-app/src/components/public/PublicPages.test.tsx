import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { PublicSite } from './PublicSite';
import { NAV, isMenu } from './navContent';

afterEach(cleanup);

function Where() {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{pathname}{search}</span>;
}

async function visit(path: string) {
  mount(<MemoryRouter initialEntries={[path]}><PublicSite /><Where /></MemoryRouter>);
  await settle(400);
}
const where = () => q('[data-testid="where"]')!.textContent;
const header = () => q('header')!;

describe('top bar', () => {
  it('is fixed to the top, so the page scrolls beneath it', async () => {
    await visit('/');
    expect(header().className).toContain('sticky');
    expect(header().className).toContain('top-0');
  });

  it('keeps the logo away from the edge, and has no pricing', async () => {
    await visit('/');
    const row = header().firstElementChild!;
    expect(row.className).toMatch(/px-4/);
    expect(row.className).toContain('lg:px-24');
    expect(header().textContent).not.toMatch(/pricing/i);
  });

  it('shows Features, Solutions, Guides and Templates, then search, Sign in and Get it free', async () => {
    await visit('/');
    const nav = q('nav[aria-label="Main"]')!;
    for (const label of ['Features', 'Solutions', 'Guides', 'Templates']) expect(nav.textContent).toContain(label);
    expect(q('button[aria-label="Search"]')).not.toBeNull();
    expect(byText('a', 'Sign in', header())!.getAttribute('href')).toBe('/login');
    expect(byText('a', 'Get it free', header())!.getAttribute('href')).toBe('/signup');
  });

  it('opens a menu on a click and closes it on Escape', async () => {
    await visit('/');
    const features = byText<HTMLButtonElement>('button', 'Features')!;
    expect(features.getAttribute('aria-expanded')).toBe('false');
    await click(features);
    expect(features.getAttribute('aria-expanded')).toBe('true');
    expect(q('[role="menu"]')!.textContent).toContain('Roadmaps');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(20);
    expect(q('[role="menu"]')).toBeNull();
  });

  it('never points a menu item at an address that does not exist', () => {
    const known = new Set(['/', '/login', '/signup', '/terms', '/privacy', '/notice', '/coming-soon']);
    const items = NAV.flatMap(e => (isMenu(e) ? e.items : [e]));
    expect(items.length).toBeGreaterThan(8);
    for (const item of items) expect(known.has(item.to.split('#')[0] || '/'), item.label).toBe(true);
  });

  it('searches the public pages and says when nothing matches', async () => {
    await visit('/');
    await click(q('button[aria-label="Search"]'));
    const box = q<HTMLInputElement>('#site-search')!;
    await typeInto(box, 'privacy');
    expect(byText('a', /Privacy Policy/)!.getAttribute('href')).toBe('/privacy');
    await typeInto(box, 'qwertyuiop');
    expect(q('#site-search')!.parentElement!.querySelector('[role="status"]')!.textContent).toContain('Nothing found');
    await typeInto(box, 'terms');
    const result = byText('a', /Terms of Service/)!;
    expect(result.closest('header')).not.toBeNull();
    await click(result);
    await settle(400);
    expect(where()).toBe('/terms');
  });
});

describe('email bar on the landing page', () => {
  it('asks for a valid email and says what is wrong', async () => {
    await visit('/');
    await click(byText('button', 'Sign up'));
    expect(q('[role="alert"]')!.textContent).toBe('Enter your email.');
    await typeInto(q<HTMLInputElement>('#hero-email'), 'not-an-email');
    await click(byText('button', 'Sign up'));
    expect(q('[role="alert"]')!.textContent).toContain('you@example.com');
    expect(where()).toBe('/');
  });

  it('opens the get-started page with the email filled in', async () => {
    await visit('/');
    await typeInto(q<HTMLInputElement>('#hero-email'), 'asha@example.com');
    await click(byText('button', 'Sign up'));
    await settle(400);
    expect(where()).toBe('/signup?email=asha%40example.com');
    expect(q<HTMLInputElement>('#start-email')!.value).toBe('asha@example.com');
  });

  it('keeps Google switched off', async () => {
    await visit('/');
    expect(byText<HTMLButtonElement>('button', 'Google')!.disabled).toBe(true);
  });
});

describe('get-started page', () => {
  it('is a window over a drawn copy of the app, with a way out', async () => {
    await visit('/signup');
    expect(q('[role="dialog"]')!.textContent).toContain('Get started with Liraspaces');
    expect(q('[data-skeleton]')).not.toBeNull();
    expect(q('a[aria-label="Close"]')!.getAttribute('href')).toBe('/');
    expect(q('a[href="/login"]')).not.toBeNull();
    expect(document.title).toBe('Get started · Liraspaces');
  });

  it('asks for the email first, then for a name and password for that email', async () => {
    await visit('/signup');
    await click(byText('button', 'Sign up'));
    expect(q('[role="alert"]')!.textContent).toBe('Enter your email.');
    expect(q('#name')).toBeNull();
    await typeInto(q<HTMLInputElement>('#start-email'), 'asha@example.com');
    await click(byText('button', 'Sign up'));
    expect(q('#name')).not.toBeNull();
    expect(q<HTMLInputElement>('#password')!.type).toBe('password');
    expect(q('[role="dialog"]')!.textContent).toContain('asha@example.com');
    await click(byText('button', 'Use a different email'));
    expect(q('#start-email')).not.toBeNull();
  });

  it('cuts a very long email from the address instead of putting it all in the field', async () => {
    await visit(`/signup?email=${'a'.repeat(600)}`);
    expect(q<HTMLInputElement>('#start-email')!.value.length).toBe(254);
  });

  it('shows an email from the address as text only', async () => {
    await visit(`/signup?email=${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
    expect(q('#start-email')!.closest('div')!.querySelector('img')).toBeNull();
    expect(q<HTMLInputElement>('#start-email')!.value).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('log-in page', () => {
  it('has Remember me with its help, a way to create an account, and the footer links', async () => {
    await visit('/login');
    expect(q<HTMLInputElement>('#remember')!.type).toBe('checkbox');
    expect(q('[role="img"][aria-label*="30 days"]')).not.toBeNull();
    expect(q('form a[href="/signup"]')!.textContent).toBe('Create an account');
    expect(q('form a[href^="mailto:"]')!.textContent).toBe("Can't log in?");
    for (const href of ['/privacy', '/notice', '/terms']) expect(q(`form a[href="${href}"]`), href).not.toBeNull();
  });

  it('keeps its corner pictures out of the reading order', async () => {
    await visit('/login');
    expect(qa('svg[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });
});
