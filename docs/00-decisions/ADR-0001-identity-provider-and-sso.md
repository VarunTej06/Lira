# ADR-0001: Identity provider and SSO protocol

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
Today there is no login: the UI assumes a fixed user ("VY"), and the only access control is a host/origin guard plus a shared link token for tablets (`lira-app/server/guard.ts`). Multi-user needs real identity, sessions and roles. The plan says users sign in through SSO; the provider is open.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Microsoft Entra ID** (OIDC) | Native on Azure; enterprise SSO, MFA, conditional access, groups; no extra vendor | Tied to Microsoft tenants; external (non-Microsoft) users need B2B/External ID setup |
| **B. Managed identity broker** (Auth0, Okta, Clerk) | Many social/enterprise connectors, fast to start | Extra vendor and cost; data leaves your tenant |
| **C. Self-hosted** (Keycloak) | Full control, free licence | You run, patch and secure it; larger operations burden |
| **D. Build own login** | None worth the risk | Highest security risk; rejected |

Protocol in all cases: **OpenID Connect, Authorization Code flow with PKCE**. SAML only if a customer requires it.

## Recommendation
Option A (Entra ID) if the organisation uses Microsoft 365, otherwise B behind an interface so the provider can change. Use a **backend-for-frontend** pattern: the API service performs the code exchange and issues an `HttpOnly; Secure; SameSite=Lax` session cookie. The browser never holds access or refresh tokens. Roles come from Lira's own database (ADR 0004), not from token claims alone; groups can map to roles.

## Consequences
- The SPA needs a `/login`, `/logout` and "who am I" call; all `/api/*` calls require a session.
- CSRF protection is needed because cookies are used (SameSite + token on state-changing calls).
- A user table keyed by the provider's stable subject (`sub`) is needed; e-mail is not an identifier.
- Local edition keeps "no login" behind a mode flag; it must be impossible to enable that mode in a hosted deployment.

## Security and operations impact
Validate `iss`, `aud`, `exp`, `nonce`, and signature via the provider's JWKS. Short session lifetime with idle timeout; revoke on user removal (SOP access management). Log every sign-in, failure and sign-out. MFA enforced at the provider.

## Revisit when
A customer needs a provider or protocol the chosen option cannot serve.
