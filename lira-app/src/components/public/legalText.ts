/**
 * Drafts of the three legal pages, for the owner to edit. They describe the hosted service as it is planned, in plain words.
 * They are not legal advice: a lawyer should read them before real customers sign up.
 */
export const OPERATOR_NAME = 'WorldXAdmins';
export const CONTACT_EMAIL = 'varuntej.y0631@gmail.com';
export const DRAFT_DATE = '19 November 2026';

export interface LegalSection { heading: string; paragraphs: readonly string[] }
export interface LegalDoc { title: string; intro: string; sections: readonly LegalSection[] }
export type LegalKey = 'terms' | 'privacy' | 'notice';

const WHO = `Liraspaces is run by ${OPERATOR_NAME}, India. You can reach the operator at ${CONTACT_EMAIL}.`;

export const LEGAL: Record<LegalKey, LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    intro: `${WHO} By creating an account or using Liraspaces you accept these terms.`,
    sections: [
      { heading: 'Your account', paragraphs: ['Give a real email address and keep your password to yourself. You are responsible for what happens under your account. Tell us at once if you think someone else has used it.'] },
      { heading: 'Your content', paragraphs: ['Tickets, documents, files and everything else you put into Liraspaces stay yours. You give us permission only to store and show them to you and the people you share them with, so the service can work.'] },
      { heading: 'What you may not do', paragraphs: ['Do not break the law, try to get into other people\'s data, attack or overload the service, or upload anything you have no right to upload.'] },
      { heading: 'The service', paragraphs: ['Liraspaces is free while it is being built. It may change, be interrupted, or have features added or removed. If we stop the service we will give notice so you can download your data first.'] },
      { heading: 'Ending your account', paragraphs: ['You can stop using Liraspaces and ask us to delete your account at any time. We may suspend an account that breaks these terms.'] },
      { heading: 'Limits', paragraphs: ['The service is provided as it is. As far as the law allows, we are not responsible for losses that come from using it or not being able to use it. Keep your own copy of anything important; you can download all of your data from the app.'] },
      { heading: 'Changes and law', paragraphs: ['If we change these terms we will say so on this page. The laws of India apply. The governing court and any other legal details are to be confirmed before launch.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `${WHO} This page says what we collect, why, and what you can do about it.`,
    sections: [
      { heading: 'What we collect', paragraphs: ['Your name and email, so we can make your account. A password, which we keep only as a one-way hash that cannot be turned back into the password. If you sign in with Google, the name and email Google gives us. The content you put into your workspace.'] },
      { heading: 'Why we use it', paragraphs: ['To run your account and your workspace, to keep the service secure, and to contact you about the service. We do not sell your data and we do not use it for advertising.'] },
      { heading: 'Who can see it', paragraphs: ['You, and the people in your organisation as your roles allow. Each organisation\'s data is kept apart from every other. The operator can reach stored data only to run and secure the service. Hosting and email providers handle data for us under their own terms.'] },
      { heading: 'Viva, the assistant', paragraphs: ['Ticket text is treated as data. If an AI provider is switched on for your organisation, the text needed for your request is sent to that provider. Viva cannot change your records without your approval.'] },
      { heading: 'Cookies', paragraphs: ['We use one sign-in cookie that keeps you logged in. It is not used for tracking or advertising.'] },
      { heading: 'How long we keep it', paragraphs: ['While your account is open. When you delete your account we delete your data, apart from backups, which are removed in the next backup cycle, and anything the law requires us to keep.'] },
      { heading: 'Your rights', paragraphs: [`You can ask to see, correct, download or delete your data, or withdraw your consent. Write to ${CONTACT_EMAIL}. You can also download all of your data from the app yourself.`] },
      { heading: 'Complaints', paragraphs: [`Send a complaint to ${CONTACT_EMAIL}. We will reply within a reasonable time, and we aim for 30 days.`] },
    ],
  },
  notice: {
    title: 'User Notice',
    intro: 'A short notice, shown when you sign up, about the data we collect from you. The Privacy Policy has the detail.',
    sections: [
      { heading: 'What we collect and why', paragraphs: ['Your name, email and password hash to make and protect your account, and the content you add to run your workspace.'] },
      { heading: 'Who is responsible', paragraphs: [WHO] },
      { heading: 'Your rights', paragraphs: [`You can see, correct, download or delete your data, and withdraw your consent, by writing to ${CONTACT_EMAIL}.`] },
      { heading: 'Where it is kept', paragraphs: ['In a database hosted in India, with each organisation kept apart from the others.'] },
    ],
  },
};
