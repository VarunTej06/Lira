# SOP: Set up the product's own email (confirm an address, reset a password)

**Owner:** product owner. **Needs:** an Azure subscription (the rehearsal's will do), the Azure rehearsal running (`infra/azure-playground/`).

What this gives the product: the sign-up "confirm your email" link, the "forgot password" link, and the "your password was changed" notice. They are sent by the product itself, from one sender address, through **Azure Communication Services Email**. This is separate from the invitation and call emails, which are sent through the organisation's own connected Google account (`google-setup.md`).

Azure's portal changes its labels from time to time. If a name below does not match, look for the nearest one and check Microsoft's current documentation for Communication Services Email.

Without this set up the product still works: sign-up does not send anything, the "Forgot password?" page says that email is not set up, and nobody is asked to confirm an address (invitations do not require a confirmed address until email works).

## 1. In the Azure portal

1. Create a **Communication Services** resource (it holds the connection string).
2. Create an **Email Communication Services** resource.
3. In the Email resource open **Provision domains** and add a domain. The quickest is an **Azure managed domain** (an address of the form `xxxx.azurecomm.net`, with the sender `DoNotReply@xxxx.azurecomm.net`). Mail from it goes out at a low limit and may land in spam, which is acceptable for the rehearsal. For real use add **your own domain** (for example `mail.liraspaces.com`) and create the DNS records the portal shows (SPF, DKIM, DKIM2) at the registrar, then wait until the domain says verified.
4. Open the Communication Services resource, **Email** then **Domains**, and **connect** the domain.
5. Open **Keys** of the Communication Services resource and copy the **connection string**. Treat it like a password.

## 2. Give them to the app

From `infra/azure-playground/`, after `az login` and `-Step infra`:

```
$env:MAIL_CONNECTION_STRING = '<the connection string>'     # typed here, never saved in a file
.\Setup-Playground.ps1 -Step mail -MailFrom 'DoNotReply@<your domain>'
.\Setup-Playground.ps1 -Step deploy -WebTag <new tag> -ApiTag <new tag>
```

The connection string goes into Key Vault and into a Container Apps secret; the sender address goes into the `MAIL_FROM` setting. Both settings come together or not at all (the API refuses to start with one of them).

## 3. Check it

Follow checklist section A45: sign up with a real address, open the link in the email, then use **Forgot password?**. Look at `/metrics` for `auth_email_sent_total`: `outcome="failed"` means the service refused the message (check the sender address and that the domain is connected).

## Reminders

With this email service set up, the API also sends reminders: 15 minutes before a call to the people invited to it (directly or through a team), and the day before a ticket is due to the person it is assigned to. Each person switches them off on the Calls page. Set `REMINDERS=false` to stop the clock altogether. They are counted in `/metrics` as `reminders_total{kind,outcome}`.

## Good to know

- The links are made from the first address in `ALLOWED_ORIGINS`, so that must be the public address (`https://test.liraspaces.com`).
- A confirmation link works for 24 hours, a reset link for one hour, and each works once. Only a hash of the link's token is stored.
- More than three links of one kind in an hour to one account are held back, and more than ten reset requests in 15 minutes from one network address are ignored without saying so.
- A person who signs in with Google has no password and is never asked for one. If someone asks to reset the password of such an account they get an email that says to use the Google button, and no link.
- Resetting a password signs the account out everywhere, and a reset link also confirms the address (the person proved they read that inbox).
