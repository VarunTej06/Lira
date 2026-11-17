# Legal documents (drafts)

Status: **DRAFT. Not legal advice.** These are first versions for an Indian lawyer to review and finish before any real customer signs up. Nothing here has been checked by a lawyer.

| Document | What it is | Shown to people |
|---|---|---|
| [`terms-of-service-DRAFT.md`](terms-of-service-DRAFT.md) | The agreement between the company and the organisation or person using the product | At sign-up (must be accepted), at login when it changes, and on the public site |
| [`privacy-policy-DRAFT.md`](privacy-policy-DRAFT.md) | The notice of what personal data is collected, why, where it is kept, for how long, and the rights people have | At sign-up (must be read and accepted), at login when it changes, and on the public site |

## What the lawyer must fill in or confirm

- The legal entity: company name, registered address, CIN or registration number. Marked `[COMPANY NAME]`, `[ADDRESS]`.
- The product name (the name "Lira" is being replaced). Marked `[PRODUCT NAME]`.
- The grievance officer and the privacy contact address. Marked `[PRIVACY EMAIL]`.
- The deletion grace period: 7 or 10 days (the owner decided "7 to 10 days"; one number must be stated). Marked `[GRACE DAYS]`.
- Which analytics and marketing tools are used; each must be named. Marked `[TOOLS]`.
- Governing law and courts (drafted as Indian law, courts at Hyderabad).
- Whether the Digital Personal Data Protection Act 2023 and its rules, as in force on the launch date, need anything this draft does not have.
- Liability limits and the refund and plan terms, once the pricing page is switched on.

## What the product must do for these documents to be true

These are requirements for the build (decided 13 to 14 Nov 2026, see `../00-decisions/README.md`):

- Sign-up shows both documents with links, and an unticked box that must be ticked. Marketing email and marketing cookies are separate, optional choices, off by default.
- The product records who accepted which version, and when. When a document changes, the next login asks again before the person continues.
- Adults only: sign-up asks the person to confirm they are 18 or over.
- A person can download their data, correct it, withdraw consent and delete their account. An Owner can delete the organisation.
- A deleted account or organisation is hidden at once, can be restored for the grace period, then is erased.
- Data is stored in Azure regions in India.
- Analytics and marketing cookies stay off until the visitor accepts them, and the choice can be changed later.
