import type { SystemMail, SystemMailer } from '../mail/mailer';

/** Stands in for the email service in tests: keeps what would have been sent. */
export class FakeMailer implements SystemMailer {
  enabled = true;
  accept = true;
  readonly sent: SystemMail[] = [];
  async send(mail: SystemMail): Promise<boolean> {
    if (!this.accept) return false;
    this.sent.push(mail);
    return true;
  }
  /** The token in the newest link sent to this address. */
  tokenFor(to: string): string | undefined {
    const last = [...this.sent].reverse().find(m => m.to === to);
    return /[?&]token=([A-Za-z0-9_-]{43})/.exec(last?.text ?? '')?.[1];
  }
}
