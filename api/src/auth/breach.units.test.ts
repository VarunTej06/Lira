import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../config';
import { MetricsService } from '../observability/metrics.service';
import { BREACHED, BreachService, isBreached, type BreachHttp } from './breach.service';

const sha = (p: string) => createHash('sha1').update(p).digest('hex').toUpperCase();
/** What the list answers for a password: every ending that shares its first five characters. */
const listWith = (password: string, count = 3): BreachHttp => vi.fn(async (url: string) => {
  expect(new URL(url).pathname.slice(1)).toBe(`range/${sha(password).slice(0, 5)}`);
  return new Response(`0018A45C4D1DEF81644B54AB7F969B88D65:2\r\n${sha(password).slice(5)}:${count}\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:0`, { status: 200 });
});

describe('the leaked-password list', () => {
  it('sends only five characters of the hash, never the password, and finds the password by its ending', async () => {
    const http = listWith('password123');
    expect(await isBreached('password123', http)).toBe(true);
    const sent = (http as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sent).toBe(`https://api.pwnedpasswords.com/range/${sha('password123').slice(0, 5)}`);
    expect(sent).not.toContain('password123');
  });

  it('says clean when the ending is not in the answer, and ignores padding rows that carry a count of 0', async () => {
    const http: BreachHttp = async () => new Response('0018A45C4D1DEF81644B54AB7F969B88D65:2', { status: 200 });
    expect(await isBreached('a-long-enough-password', http)).toBe(false);
    expect(await isBreached('password123', listWith('password123', 0))).toBe(false);
  });

  it('says unknown, not clean, when the list answers with an error or cannot be reached', async () => {
    expect(await isBreached('x', async () => new Response('no', { status: 503 }))).toBeNull();
    expect(await isBreached('x', async () => { throw new TypeError('offline'); })).toBeNull();
  });
});

describe('refusing a leaked password', () => {
  const service = (breachCheck: boolean, http: BreachHttp) => new BreachService({ breachCheck } as Config, http, new MetricsService());

  it('refuses a leaked password with a message for the password field', async () => {
    await expect(service(true, listWith('password123')).require('password123')).rejects.toMatchObject({ response: { code: 'breached_password', message: BREACHED, fields: { password: BREACHED } } });
  });

  it('accepts a password that is not in the list, and one it could not check, and asks nothing when switched off', async () => {
    await expect(service(true, async () => new Response('', { status: 200 })).require('fine-and-long-enough')).resolves.toBeUndefined();
    await expect(service(true, async () => { throw new TypeError('offline'); }).require('whatever-long-enough')).resolves.toBeUndefined();
    const http = vi.fn();
    await expect(service(false, http as unknown as BreachHttp).require('password123')).resolves.toBeUndefined();
    expect(http).not.toHaveBeenCalled();
  });
});
