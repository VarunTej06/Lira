import { describe, expect, it } from 'vitest';
import { FakeMailer } from '../testing/fake-mailer';
import { NoSystemMailer } from './mailer';

describe('the system mailer', () => {
  it('is off, and sends nothing, when no email service is set up', async () => {
    const none = new NoSystemMailer();
    expect(none.enabled).toBe(false);
    expect(await none.send()).toBe(false);
  });

  it('the test double keeps what it is given and finds the token in the newest link for an address', async () => {
    const mail = new FakeMailer();
    const old = 'A'.repeat(43);
    const fresh = 'B'.repeat(43);
    await mail.send({ to: 'a@b.co', subject: 's', text: `open https://x.test/verify-email?token=${old}` });
    await mail.send({ to: 'c@d.co', subject: 's', text: 'no link here' });
    await mail.send({ to: 'a@b.co', subject: 's', text: `open https://x.test/reset-password?token=${fresh}` });
    expect(mail.tokenFor('a@b.co')).toBe(fresh);
    expect(mail.tokenFor('c@d.co')).toBeUndefined();
    mail.accept = false;
    expect(await mail.send({ to: 'a@b.co', subject: 's', text: '' })).toBe(false);
    expect(mail.sent).toHaveLength(3);
  });
});
