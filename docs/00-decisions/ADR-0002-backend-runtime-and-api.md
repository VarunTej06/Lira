# ADR-0002: Backend runtime and API style

- **Status:** Proposed
- **Date proposed:** 2026-11-09
- **Decision owner:** (to be named)

## Context
The only server today is a Vite dev-server plugin (`lira-app/vite.config.ts`, `lira-app/server/`). It exposes `/api/health`, `/data`, `/save`, `/kv`, `/spaces`, `/lan`, `/snapshot(s)` and **cannot run in production** (`npm run preview` or a build cannot save). A real API service is required. The team works in TypeScript and already has tested guard, disk store and snapshot code.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| **A. Node.js + TypeScript** (Fastify or NestJS), REST + OpenAPI | Same language and types as the UI; share validation schemas; reuse `guard.ts` ideas and tests | Single-threaded runtime; discipline needed for structure |
| **B. Node + tRPC** | End-to-end types | Weaker public contract; harder for third-party integrations |
| **C. .NET or Java** | Strong enterprise ecosystem | New language for the team; no schema sharing with UI |
| **D. Backend-as-a-service** (Supabase, Firebase) | Fast start, built-in auth/RLS | Vendor lock-in; limits on custom logic and hosting choice |

## Recommendation
Option A with **Fastify** (small, fast, schema-first) and **zod** schemas shared from a `core` package. Publish an **OpenAPI** document generated from the schemas. Stateless containers; all state in the database and object store. Keep Viva's pure logic (`src/services/ai/*`) in the shared package so the server can run it.

## Consequences
- The dev-server plugin remains for the local edition only.
- API versioned under `/api/v1`; breaking changes need a new version.
- Server-side validation replaces today's partial shape checks in `diskStore.ts`.
- Contract tests between UI and API.

## Security and operations impact
All authorisation lives here (see ADR 0004). Rate limiting, request size limits, structured logs with request IDs, and no stack traces in responses.

## Revisit when
Throughput or team skills make the runtime a bottleneck.
