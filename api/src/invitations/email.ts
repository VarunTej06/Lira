export interface EmailMessage { to: string; subject: string; text: string }

/** Sends one email. Resolves false when no email service is connected, so the caller can say so instead of pretending it was sent. */
export interface EmailSender { send(message: EmailMessage): Promise<boolean> }

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/** Used until an email service (Gmail) is connected: nothing is sent. */
export class NoEmailSender implements EmailSender {
  async send(): Promise<boolean> { return false; }
}
