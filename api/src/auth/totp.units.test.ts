import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, codeFor, looksLikeRecoveryCode, newRecoveryCodes, newSecret, normaliseRecoveryCode, otpauthUri, stepAt, verifyCode } from './totp';

/** RFC 6238's test secret, the ASCII text 12345678901234567890, and its published codes (the last six digits of the eight-digit ones). */
const RFC = base32Encode(Buffer.from('12345678901234567890'));

describe('one-time codes from an authenticator app', () => {
  it('gives the codes the standard publishes for its test times', () => {
    expect(codeFor(RFC, stepAt(59_000))).toBe('287082');
    expect(codeFor(RFC, stepAt(1_111_111_109_000))).toBe('081804');
    expect(codeFor(RFC, stepAt(1_234_567_890_000))).toBe('005924');
  });

  it('writes and reads base32 both ways, and refuses text that is not base32', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) expect(base32Decode(base32Encode(Buffer.from(text))).toString()).toBe(text);
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(() => base32Decode('not base32!')).toThrow();
    expect(newSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(newSecret()).not.toBe(newSecret());
  });

  it('accepts the current code and the steps either side of it, and nothing further away', () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(verifyCode(RFC, codeFor(RFC, step), now, 0)).toBe(step);
    expect(verifyCode(RFC, codeFor(RFC, step - 1), now, 0)).toBe(step - 1);
    expect(verifyCode(RFC, codeFor(RFC, step + 1), now, 0)).toBe(step + 1);
    expect(verifyCode(RFC, codeFor(RFC, step - 2), now, 0)).toBeNull();
    expect(verifyCode(RFC, codeFor(RFC, step + 2), now, 0)).toBeNull();
  });

  it('works once: a step that was accepted, or an earlier one, is refused', () => {
    const now = 1_700_000_000_000;
    const step = stepAt(now);
    expect(verifyCode(RFC, codeFor(RFC, step), now, step)).toBeNull();
    expect(verifyCode(RFC, codeFor(RFC, step - 1), now, step)).toBeNull();
    expect(verifyCode(RFC, codeFor(RFC, step + 1), now, step)).toBe(step + 1);
  });

  it('refuses anything that is not six digits, and a wrong code', () => {
    const now = 1_700_000_000_000;
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 345', '١٢٣٤٥٦']) expect(verifyCode(RFC, bad, now, 0), bad).toBeNull();
    const right = codeFor(RFC, stepAt(now));
    expect(verifyCode(RFC, right === '000000' ? '000001' : '000000', now, 0)).toBeNull();
  });

  it('makes the address an app can use, with the account and the key', () => {
    const uri = otpauthUri('ABCDEFGH', 'a@b.co');
    expect(uri).toBe('otpauth://totp/Liraspaces%3Aa%40b.co?secret=ABCDEFGH&issuer=Liraspaces&algorithm=SHA1&digits=6&period=30');
  });
});

describe('recovery codes', () => {
  it('makes ten different codes that are easy to read out', () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
    expect(codes.join('')).not.toMatch(/[01ilo]/); // nothing that looks like another character
  });

  it('tells a recovery code from an app code, and reads it with or without the dash and in any case', () => {
    expect(looksLikeRecoveryCode('k3m9x-p2w7q')).toBe(true);
    expect(looksLikeRecoveryCode(' K3M9XP2W7Q ')).toBe(true);
    for (const no of ['123456', '', 'k3m9x', 'k3m9x-p2w7q-z', '12345-67890x']) expect(looksLikeRecoveryCode(no), no).toBe(false);
    expect(normaliseRecoveryCode(' K3M9XP2W7Q ')).toBe('k3m9x-p2w7q');
    expect(normaliseRecoveryCode('k3m9x-p2w7q')).toBe('k3m9x-p2w7q');
  });
});
