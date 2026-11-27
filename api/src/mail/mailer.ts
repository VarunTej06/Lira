/** An email the product sends by itself (confirm an address, reset a password, remind), from the product's own address. */
export interface SystemMail { to: string; subject: string; text: string }

export interface SystemMailer {
  /** False until an email service is set up: the pages then say so instead of promising an email that never comes. */
  readonly enabled: boolean;
  /** True when the service accepted the message. */
  send(mail: SystemMail): Promise<boolean>;
}

export const SYSTEM_MAILER = Symbol('SYSTEM_MAILER');

/** Used when no email service is set up: nothing is sent. */
export class NoSystemMailer implements SystemMailer {
  readonly enabled = false;
  async send(): Promise<boolean> { return false; }
}
