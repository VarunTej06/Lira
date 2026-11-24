import { EmailClient } from '@azure/communication-email';
import { logLine } from '../observability/log';
import type { SystemMail, SystemMailer } from './mailer';

/** Sends through Azure Communication Services Email. The connection string stays in the settings and never reaches a log. */
export class AcsMailer implements SystemMailer {
  readonly enabled = true;
  private readonly client: EmailClient;

  constructor(connectionString: string, private readonly from: string) {
    this.client = new EmailClient(connectionString);
  }

  async send(mail: SystemMail): Promise<boolean> {
    try {
      // beginSend returns once the service has accepted the message; waiting for delivery would hold the request for seconds.
      await this.client.beginSend({ senderAddress: this.from, content: { subject: mail.subject, plainText: mail.text }, recipients: { to: [{ address: mail.to }] } });
      return true;
    } catch (error) {
      logLine('warn', 'system email was not accepted', { reason: error instanceof Error ? error.name : 'unknown' });
      return false;
    }
  }
}
