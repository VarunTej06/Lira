import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { byText, cleanup, click, mount, q, qa, settle } from '../../test/render';
import { PublicSite } from './PublicSite';
import { paintTheme } from '../../utils/theme';
import { CONTACT_EMAIL, LEGAL, OPERATOR_NAME } from './legalText';

afterEach(cleanup);

async function visit(path: string) {
  mount(<MemoryRouter initialEntries={[path]}><PublicSite /></MemoryRouter>);
  await settle(400);
}
const text = () => document.body.textContent ?? '';

describe('public site', () => {
  it('shows the landing page with the headline, the sample board and both ways in', async () => {
    await visit('/');
    expect(q('h1')!.textContent).toContain('Everything you are working on and learning, in one place.');
    expect(q('[role="img"][aria-label^="Sample space"]')).not.toBeNull();
    expect(qa('a[href="/signup"]').length).toBeGreaterThan(0);
    expect(qa('a[href="/login"]').length).toBeGreaterThan(0);
    expect(text()).toContain('Separate by organisation.');
  });

  it('has no pricing, testimonials or sign-in that pretends to work', async () => {
    await visit('/');
    expect(text()).not.toMatch(/per month|\/mo\b|testimonial/i);
  });

  it('links the Terms, the Privacy Policy, the User Notice and the contact in the footer of every page', async () => {
    for (const path of ['/', '/signup', '/terms']) {
      cleanup();
      await visit(path);
      const footer = q('footer')!;
      for (const href of ['/terms', '/privacy', '/notice']) expect(footer.querySelector(`a[href="${href}"]`), `${path} ${href}`).not.toBeNull();
      expect(footer.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull();
      expect(footer.textContent).toContain(OPERATOR_NAME);
    }
  });

  it('shows only the log-in card on /login: no top bar, no footer, no search', async () => {
    await visit('/login');
    expect(q('form')).not.toBeNull();
    expect(q('header')).toBeNull();
    expect(q('footer')).toBeNull();
    expect(q('[aria-label="Search"], [role="search"]')).toBeNull();
  });

  it('has no search on the sign-up page or on the Terms, Privacy and User Notice pages, but keeps it on the landing page', async () => {
    for (const path of ['/signup', '/terms', '/privacy', '/notice']) {
      cleanup();
      await visit(path);
      expect(q('header'), path).not.toBeNull();
      expect(q('header button[aria-label*="earch"]'), path).toBeNull();
    }
    cleanup();
    await visit('/');
    expect(q('header button[aria-label*="earch"]')).not.toBeNull();
  });

  it('shows each legal page as a draft with the operator named', async () => {
    for (const [path, key] of [['/terms', 'terms'], ['/privacy', 'privacy'], ['/notice', 'notice']] as const) {
      cleanup();
      await visit(path);
      expect(q('h1')!.textContent).toBe(LEGAL[key].title);
      expect(q('[role="note"]')!.textContent).toContain('not yet reviewed by a lawyer');
      expect(text()).toContain(OPERATOR_NAME);
      expect(document.title).toBe(`${LEGAL[key].title} · Liraspaces`);
    }
  });

  it('sends an unknown address back to the landing page', async () => {
    await visit('/no-such-page');
    expect(q('h1')!.textContent).toContain('Everything you are working on');
  });

  it('has a coming-soon page', async () => {
    await visit('/coming-soon');
    expect(q('h1')!.textContent).toBe('Still baking');
    expect(document.title).toBe('Coming soon · Liraspaces');
  });

  it('switches between light and dark with the icon button in the top bar, and keeps the choice for the app', async () => {
    paintTheme(); // as main.tsx does before the first render
    await visit('/');
    const before = document.documentElement.classList.contains('dark');
    expect(before).toBe(true); // dark (Pace) is the default
    const toggle = () => q('button[aria-label^="Switch to"]');
    expect(toggle()!.getAttribute('aria-label')).toBe('Switch to light mode');
    await click(toggle());
    expect(document.documentElement.classList.contains('dark')).toBe(!before);
    expect(toggle()!.getAttribute('aria-label')).toBe('Switch to dark mode');
    await click(toggle());
    expect(document.documentElement.classList.contains('dark')).toBe(before);
  });
});

describe('log in and sign up', () => {
  it('log in asks for email and password, names the page, and has no name field', async () => {
    await visit('/login');
    expect(q('h1')!.textContent).toBe('Log in to continue');
    expect(document.title).toBe('Log in to continue · Liraspaces');
    expect(q('#email')).not.toBeNull();
    expect(q<HTMLInputElement>('#password')!.type).toBe('password');
    expect(q('#name')).toBeNull();
  });

  it('says what is wrong with each empty field and marks it for screen readers', async () => {
    await visit('/login');
    await click(byText('button', 'Log in'));
    const alerts = qa('[role="alert"]').map(a => a.textContent);
    expect(alerts).toEqual(['Enter your email.', 'Enter your password.']);
    expect(q('#email')!.getAttribute('aria-invalid')).toBe('true');
    expect(q('[role="status"]')).toBeNull();
  });

  it('keeps Google sign-in switched off until it exists', async () => {
    await visit('/login');
    expect(byText<HTMLButtonElement>('button', 'Google')!.disabled).toBe(true);
  });
});
