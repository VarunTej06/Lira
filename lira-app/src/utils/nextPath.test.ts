import { describe, expect, it } from 'vitest';
import { nextAfterSignIn, withNext } from './nextPath';

const TOKEN = 'A'.repeat(43);

describe('where to go after signing in', () => {
  it('goes back to an invitation, and to the app otherwise', () => {
    expect(nextAfterSignIn(`/invite?token=${TOKEN}`)).toBe(`/invite?token=${TOKEN}`);
    expect(nextAfterSignIn(null)).toBe('/app');
    expect(nextAfterSignIn('')).toBe('/app');
  });

  it('never goes anywhere else: not another site, not another page, not a malformed or longer invitation address', () => {
    for (const bad of ['https://evil.example/', '//evil.example', '/app', '/admin', `/invite?token=${TOKEN}&x=1`, `/invite?token=short`, `/invite?token=${TOKEN}\n`, `javascript:alert(1)`, `/invite?token=${TOKEN}#x`]) {
      expect(nextAfterSignIn(bad), bad).toBe('/app');
    }
  });

  it('writes the log-in and sign-up addresses with the invitation safely encoded', () => {
    expect(withNext('/login', `/invite?token=${TOKEN}`)).toBe(`/login?next=${encodeURIComponent(`/invite?token=${TOKEN}`)}`);
    expect(nextAfterSignIn(new URLSearchParams(withNext('/signup', `/invite?token=${TOKEN}`).split('?')[1]).get('next'))).toBe(`/invite?token=${TOKEN}`);
  });
});
