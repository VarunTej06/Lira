import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD, validateAuth } from './authForm';

const ok = { name: 'Asha Rao', email: 'asha@example.com', password: 'a-long-enough-pass' };

describe('validateAuth', () => {
  it('accepts a complete form in both modes', () => {
    expect(validateAuth('login', ok)).toEqual({});
    expect(validateAuth('signup', ok)).toEqual({});
  });

  it('asks for every field on sign-up, but not the name on log-in', () => {
    const empty = { name: '', email: '', password: '' };
    expect(Object.keys(validateAuth('signup', empty)).sort()).toEqual(['email', 'name', 'password']);
    expect(Object.keys(validateAuth('login', empty)).sort()).toEqual(['email', 'password']);
  });

  it('rejects emails that are not addresses', () => {
    for (const email of ['asha', 'asha@', '@example.com', 'asha@example', 'a sha@example.com', 'asha@@example.com']) {
      expect(validateAuth('login', { ...ok, email }).email, email).toBeDefined();
    }
  });

  it('asks for a long password only when signing up, so an old short one can still log in', () => {
    const short = 'x'.repeat(MIN_PASSWORD - 1);
    expect(validateAuth('signup', { ...ok, password: short }).password).toContain(String(MIN_PASSWORD));
    expect(validateAuth('login', { ...ok, password: short })).toEqual({});
    expect(validateAuth('signup', { ...ok, password: 'x'.repeat(MIN_PASSWORD) })).toEqual({});
  });

  it('rejects oversized values instead of passing them on', () => {
    expect(validateAuth('signup', { ...ok, name: 'n'.repeat(101) }).name).toBeDefined();
    expect(validateAuth('login', { ...ok, email: `${'e'.repeat(250)}@x.io` }).email).toBeDefined();
    expect(validateAuth('login', { ...ok, password: 'p'.repeat(129) }).password).toBeDefined();
  });

  it('treats a name or email of only spaces as empty', () => {
    expect(validateAuth('signup', { ...ok, name: '   ' }).name).toBeDefined();
    expect(validateAuth('login', { ...ok, email: '   ' }).email).toBeDefined();
  });
});
