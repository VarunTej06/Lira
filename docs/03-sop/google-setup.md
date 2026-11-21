# SOP: Connect Google (Meet links and invitation emails)

**Owner:** product owner. **Needs:** a Google Cloud project that you own (a sandbox project is fine to try it first), the Azure rehearsal running (`infra/azure-playground/`), and the owner's Google account for the sign-in.

What this gives the product: when the owner connects a Google account, a stand-up made without a pasted link gets a **Google Meet** link made by the app, and every invited person gets an **email** from that account. Without it the app still works: people paste a Meet or Teams link, and no email is sent (the page says so).

Google's console changes its labels from time to time. If a name below does not match, look for the nearest one and check Google's current documentation: the [Meet REST API](https://developers.google.com/workspace/meet/api/guides/authenticate-authorize) and the [Gmail API](https://developers.google.com/workspace/gmail/api/auth/scopes). This document was written from those pages and from the code; **it has not yet been run against a real Google project.**

## 1. In the Google Cloud console

1. Create or choose a project.
2. Enable two APIs: the **Google Meet REST API** and the **Gmail API**.
3. Configure the **OAuth consent screen**. While you test, keep it in testing mode and add the Google accounts that will sign in as **test users** (the owner's account). A public product later needs Google's verification for the two sensitive permissions below; plan time for it.
4. Add the permissions (scopes) the app asks for, and no others:
   - `openid` and `email` (to learn which account was connected)
   - `https://www.googleapis.com/auth/meetings.space.created` (make a Meet link)
   - `https://www.googleapis.com/auth/gmail.send` (send the invitation emails)
5. Create an **OAuth client ID** of type **Web application**. Add **two** authorised redirect URIs, exactly (for the rehearsal the domain is `test.liraspaces.com`):
   - `https://<your domain>/api/google/callback` (the owner connecting a Google account: Meet links and emails)
   - `https://<your domain>/api/auth/google/callback` (people signing up and in with Google)

   Copy the client ID and the client secret. The same client serves both. People who sign in with Google need no test-user entry once the app is published; while it is in Testing, only the test users can sign in.

## 2. Give them to the app

From `infra/azure-playground/`, after `az login` and `-Step infra`:

```
$env:GOOGLE_CLIENT_SECRET = '<the client secret>'     # typed here, never saved in a file
.\Setup-Playground.ps1 -Step google -GoogleClientId '<the client id>'
.\Setup-Playground.ps1 -Step deploy
```

The script keeps the secret and a freshly made 32-byte encryption key in Key Vault, and `deploy` hands them to the API as settings (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`). Nothing goes into the repository or an image. Clear the variable afterwards: `Remove-Item Env:GOOGLE_CLIENT_SECRET`.

## 3. Connect the account

People who signed up with the Google button already have this done (section 4). Everyone else: sign in to the hosted app as the **owner**, open the account menu, **Stand-up calls**, and press **Connect Google**. Sign in at Google, agree to the permissions, and you are sent back with "Google is connected". The app keeps only a refresh token, **encrypted** (AES-256-GCM) with the key from Key Vault; if the database were copied, the token could not be read without that key. **Disconnect Google** on the same page deletes it and asks Google to revoke it.

## 4. Sign-up and sign-in with Google

With the settings above the **Google** button on the log-in page and on the landing page's sign-up bar turns on by itself (the page asks the server `/api/auth/providers`). A person presses it, chooses a Google account, agrees, and is signed in; the first time, an account and an organisation of one are made for them, as owner, with no password. The **log-in** page asks only for `openid`, `email` and `profile`. The **sign-up** bar on the landing page asks once for everything a new owner needs (those three, the Meet permission and the Gmail send permission, with offline access), and when the person agrees to all of them the app keeps the encrypted refresh token for their new organisation, so the Calls page does not ask them to **Connect Google** again. If they untick a permission, or sign up with email and password, they are signed in without the connection and the Calls page offers **Connect Google**. If someone had earlier signed up with a password for the same address, the person who has just proved they own it at Google takes the account over: its password is removed and its sessions are ended (nobody had proved the address when that password was set). Google sign-in works only on the first address in `ALLOWED_ORIGINS` (the one registered above).

## 5. Try it

Schedule a stand-up and leave the link empty. Expect: a `meet.google.com` link on the call, and, for each invited person, an email from the connected account with the time, the link, and "repeats ..." if it is a series. Check the audit log: `google.connect`, `standup.create` (no link or address in them).

## If it does not work

| What you see | Likely cause |
|---|---|
| The Google button on the log-in page is greyed out | The API has no Google settings (`/api/auth/providers` says `google: false`): run `-Step google` and `-Step deploy` |
| After pressing Google you land on the log-in page with "Google sign-in did not work" | The second redirect URI is missing or not exact in the OAuth client, the browser is on a different address than the first allowed origin, the clock is wrong, or the account is not a test user while the app is in Testing. The audit log has a `auth.google` row with a reason (`state`, `exchange` or `token`) |
| "Google is not set up on this server yet" | The API has no Google settings: run `-Step google` and `-Step deploy` again |
| Google shows "access blocked" or "app not verified" | The account is not listed as a test user on the consent screen |
| "redirect_uri_mismatch" at Google | The redirect URI in step 1.5 is not exactly `https://<domain>/api/google/callback` |
| The call is made but "nobody was emailed" | Gmail refused (quota, a missing permission, or the account is not allowed to send): disconnect and connect again, allowing everything asked |
| "Paste a link, or ask the owner to connect Google" | Google is not connected, or the Meet API refused: check that the Meet REST API is enabled in the project and that the account type is allowed to use it (not confirmed for personal Gmail accounts) |

## Moving to the real Google project later

Make a new OAuth client in the real project, run `-Step google` with its id and secret, and `-Step deploy`. The owner connects again. No code changes.
