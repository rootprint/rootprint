# apps/api — Agent Guide

## About

Hono backend on Bun. Responsibilities: log ingest (NDJSON + OTLP), search proxy to Quickwit, user/auth, admin operations, and API keys (ingest, personal, and service-account).

The frontend in `apps/web` calls this API over HTTP.

For repo-wide rules (Bun, Prettier, TS strict, no tests), see the root `AGENTS.md`.

## Stack

- Runtime: Bun
- HTTP framework: Hono 4
- ORM: Drizzle + `pg` (PostgreSQL)
- Auth: Better Auth
- Validation: Valibot
- Quickwit client: `quickwit-js`
- Protobuf codegen: buf + `@bufbuild/protoc-gen-es`

## Run, Build, Check

```bash
bun --filter api dev         # hot-reload via `bun --hot`
bun --filter api build       # bundle to dist/
bun --filter api start       # run dist/app.js
bun --filter api check       # tsc --noEmit
bun --filter api lint        # oxlint
```

Root convenience: `bun run dev:api`, `bun run build:api`, `bun run start:api`.

## Source Layout

| Path               | Purpose                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`       | Hono app composition, middleware mount, error handler, SPA static serving, boot (`main()`)                                                                                                                                                              |
| `src/config.ts`    | Resolved runtime config object                                                                                                                                                                                                                          |
| `src/env.ts`       | Hono context types: `AppEnv` (`requestId`, `session?`, `apiKey?`), `AuthedEnv`, `KeyedEnv`                                                                                                                                                              |
| `src/types.ts`     | Public, pure-type surface re-exported via `exports['./types']`                                                                                                                                                                                          |
| `src/index.ts`     | Workspace package entry                                                                                                                                                                                                                                 |
| `src/routes/`      | One file per resource (`api-keys`, `auth`, `exports`, `health`, `indexes`, `monitoring`, `service-accounts`, `settings`, `shares`, `traces`, `users`, `views`); `routes/admin/` (`activity`, `cluster`, `metrics`); `routes/ingest/` (`ndjson`, `otlp`) |
| `src/services/`    | `*.service.ts` — business logic called from routes                                                                                                                                                                                                      |
| `src/middleware/`  | `request-context`, `require-user`, `require-admin`, `require-api-key`, `require-user-or-personal-key`, `with-index-config`, `with-index-meta`                                                                                                           |
| `src/schemas/`     | Valibot request schemas per resource; response schemas under `schemas/responses/`                                                                                                                                                                       |
| `src/db/`          | Drizzle schemas (`schema.ts`, `auth.schema.ts`) and DB client (`index.ts`)                                                                                                                                                                              |
| `src/lib/`         | Cross-cutting clients and IO: `auth`, `db`, `quickwit`, `quickwit-proxy`, `quickwit-metrics`, `secret`, `openapi/`, `query/`                                                                                                                            |
| `src/utils/`       | Pure helpers: `http-error`, `quickwit-error`, `otlp-response`, `bearer`, `params`, `valibot`, `require-env`, `db`                                                                                                                                       |
| `src/gen/`         | Generated protobuf code — **do not edit**                                                                                                                                                                                                               |
| `src/constants.ts` | Domain constants                                                                                                                                                                                                                                        |

Sibling top-level dirs:

- `proto/` — vendored upstream `.proto` files (OTEL, googleapis). Don't edit; refresh via the recipe in `proto/README.md`.
- `drizzle/` — generated SQL migrations.
- `bruno/` — Bruno API request collections for manual testing.
- `buf.yaml`, `buf.gen.yaml` — buf configuration.
- `drizzle.config.ts` — Drizzle Kit configuration.

## Types Contract

- Public, cross-workspace types go in `src/types.ts` and are exported via `exports['./types']` in `package.json`. Consumers import as `import type { LogHit } from 'api/types'`.
- `src/types.ts` is pure types only — no runtime exports.
- Internal helper types live alongside the code that uses them. Move a type to `src/types.ts` only when more than one workspace needs it.

## Routing & Request Handling

- Each resource gets a `Hono` router and is mounted with `app.route('/path', router)` in `src/app.ts`.
- Session-protected routers wrap via the `withAuth()` helper, which mounts `requireUser`; admin routers additionally mount `requireAdmin` themselves. Ingest routes use `requireIngestKey` from `require-api-key`.
- Read context values via `c.get('requestId' | 'session' | 'apiKey')`. The env types (`AppEnv`, `AuthedEnv`, `KeyedEnv`) live in `src/env.ts`.

## Error Handling

- Throw `HttpError` from `src/utils/http-error.ts` to signal HTTP-level failures.
- The central `app.onError` handler in `src/app.ts` translates errors:
  - Paths under `/v1/` get OTLP-style error responses (`otlpError`, `otlpErrorFromHttpError`).
  - Other paths get JSON `{ error: { code, message, statusCode, requestId } }`.
- Never return raw 500s with internal messages or stack traces.

## Validation

- Use Valibot for all external input (request bodies, query params, headers). The `app.onError` handler maps `ValiError` to a 400 with a structured detail list.
- Infer TS types from Valibot schemas where possible (`v.InferOutput<typeof Schema>`).
- Request schemas live in `src/schemas/<resource>.ts` (shared path-param schemas in `src/utils/params.ts`); response schemas in `src/schemas/responses/<resource>.ts`. Route files never define schemas inline — they import them.

## Database

- Schemas: `src/db/schema.ts` (app) and `src/db/auth.schema.ts` (Better Auth).
- Migrations live in `apps/api/drizzle/`.
- Commands (all via `bun --filter api`):
  - `db:generate` — generate migration from schema diff.
  - `db:migrate` — apply pending migrations.
  - `db:studio` — open Drizzle Studio.
- If you change schemas, regenerate and run `db:migrate` locally before opening a PR.

## Protobuf / Codegen

- `proto/` contains vendored upstream `.proto` files for OTEL ingest and googleapis status codes.
- Generated output goes to `src/gen/` — never edit by hand.
- Refresh recipe and version pins live in `proto/README.md`. After refreshing, run `bun --filter api proto:gen` and review the diff in `src/gen/`.

## Bruno

- `bruno/` holds Bruno API request collections for manual testing.
- When you add or change endpoints, update the collection so the next person doesn't have to reverse-engineer the API.

## Authentication

- Better Auth setup lives in `src/lib/auth.ts`. Database tables follow Better Auth's schema (`src/db/auth.schema.ts`).
- Session-based auth (cookies) for the web app; ingest API keys for log producers (`requireIngestKey` in `src/middleware/require-api-key.ts`).
- Read endpoints additionally accept a personal or service-account bearer key via `requireUserOrPersonalKey` (`src/middleware/require-user-or-personal-key.ts`), falling back to the session cookie when no bearer is present.
- Google, GitHub, and one generic OpenID Connect provider are configured at runtime via the admin settings UI (writes to `app_settings`). Provider env vars (`GOOGLE_CLIENT_ID` etc.) are **not** read. Better Auth is rebuilt with `reloadAuth()` after credential and password-toggle writes only; allow-list writes are read from the DB at each OAuth sign-in and do not reload.
- Google sign-in is gated by a domain allowlist; GitHub sign-in by an org allowlist. Both live in `app_settings` and are enforced in `user.validateUserInfo` (`lib/auth.ts`), which Better Auth runs on every OAuth create, link, and repeat sign-in before any row is written. The GitHub verdict is computed in a `getUserInfo` wrapper (the hook never sees the access token) and carried on the profile as `orgAllowed`. If creds are present but the allowlist is empty or missing, all sign-ins for that provider are rejected and the providers endpoint reports it disabled. Nothing re-checks a provider during a session: a removed domain or org takes effect at the user's next sign-in. OIDC has no app-side allowlist: the IdP decides who may sign in. The IdP must echo the nonce and support PKCE (both required by the plugin config), and ID token signatures are verified against the discovered JWKS (`requireIdTokenVerification`). `oidc` sits in `trustedProviders` alongside Google and GitHub — many IdPs (Entra ID notably) never send `email_verified`, and linking an untrusted provider requires it. OIDC `accountId` is `<issuerUrl>|<sub>` (`accountSubject`), so rows from a previous issuer can never match.
- The issuer URL must be `https:` (or loopback `http:`) — the token endpoint carries the client secret. Discovery is fetched on save and again at each Better Auth build. The build probes the issuer with the same 5 s check and omits the provider when it fails (`loadReachableAuthConfig` in `lib/auth.ts`), because the plugin's own discovery fetch has no timeout and every request awaits init; an unreachable issuer therefore leaves OIDC off until the next auth settings change or restart rather than stalling the auth path.
- `password_sign_in_disabled` closes `/sign-in/email` via `disabledPaths`. Nothing checks that an external provider is configured or working first — an admin can lock themselves out. Break-glass: delete that row, then restart the API (or save any auth setting) so `disabledPaths` is rebuilt; if the admin has no credential row, insert an `invite_token` row and open `/auth/setup?token=…`.
- Linking a provider (`google`, `github`, `oidc`) to a user deletes any pending invite and nothing else; any credential row survives, so a password user keeps their password. Account linking is auto-enabled for configured providers with `requireLocalEmailVerified: false`, so an invited user who has not set a password can complete onboarding through a provider.
- Deleting a provider's credentials revokes the sessions of every user with an account row for that provider, in the same transaction. Deleting OIDC credentials, or saving them with a different issuer URL or client ID, also deletes the `oidc` account rows; users re-link by email at their next sign-in or get a password from an admin reset. Personal API keys are untouched. An OAuth callback already in progress may still complete.
- Admin password reset and invite reissue work for any human user. `setupPassword` transactionally consumes the invite, replaces every existing credential row with exactly one newly hashed credential, and verifies the email. Users created by an admin start without a credential row and can instead complete onboarding through a configured provider.
- No session cookie cache: every authenticated request reads the session from the database, so demotion and revocation apply on the next request. The legacy ban columns remain in the database but are unused. OAuth access and refresh tokens are stored encrypted (`account.encryptOAuthTokens`). `reloadAuth()` is serialized within one process; runtime auth rebuilding and in-memory rate limiting assume a single API process.
- Better Auth's admin plugin is not installed. `/api/users` and `/api/service-accounts` are the only user-management admin HTTP surface, and their four management operations use direct database queries.

## Traces

- Spans live in one Quickwit index, the span store, named by `config.traceIndexId` (env `TRACE_INDEX_ID`). The default `otel-traces-v0_9` tracks the **Quickwit** version — a 0.8 cluster needs `otel-traces-v0_7`. A wrong value fails silently: `getTrace` treats a missing index as an empty trace so a logs-only cluster doesn't error, which means a typo looks like "no spans" rather than a misconfiguration.
- There is **no raw span search and no trace list**. `GET /api/traces/:traceId` retrieves one trace, while `GET /api/monitoring/services` returns aggregate service-health data from server spans. A trace is reached from a log carrying its id, or by pasting the id into the log search box. Raw span search was cut deliberately — it duplicated the log explorer's shell without its field panel, saved views, or shares. When it returns it belongs in the explore page as a trace-aware index, not as a second explorer.
- It is a raw `trace_id:<hex>` search with **no time range**, not Quickwit's Jaeger API — that API forced a `now - lookback_period_hours` window (72h default), making older traces findable but unopenable. Capped at `MAX_TRACE_SPANS`; past the cap the kept spans are an arbitrary subset (the query is unsorted, the client orders the waterfall) and `truncated` is set.
- **Trace ids are not authorization.** `/api/traces` is a top-level mount, not nested under an index, so there is no per-index gate: any user or personal key with `logs:read` can read any trace. That matches log search, where the same holds for any index.
- The span store is not readable as a log index — `assertNotTraceIndex` in `getIndexConfig` 404s it, so log-explorer, histogram, field-values, and export all reject it. `isTraceIndex` on `IndexSummary`/`IndexDetail` is derived from `config.traceIndexId`, not stored.
- `POST /v1/traces` routes to `config.traceIndexId` for **every** ingest key, whatever log index it was created against — no per-key destination exists. `createApiKey` refuses to anchor a key to the span store (`400 INDEX_IS_TRACE_INDEX`), which would let it write log documents there.

## Environment Variables

Required:

| Var            | Purpose                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string                                                    |
| `ORIGIN`       | Canonical public URL used for auth callbacks, invite links, CORS, and cookies |
| `QUICKWIT_URL` | Quickwit REST endpoint (e.g. `http://localhost:7280`)                         |

Optional:

| Var                           | Purpose                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`          | Override the auto-generated Better Auth signing secret         |
| `FRONTEND_URL`                | Additional allowed CORS origin for split SPA + API deployments |
| `PORT`                        | Override the HTTP listen port (default `8282`)                 |
| `TRACE_INDEX_ID`              | Quickwit index holding spans (default `otel-traces-v0_9`)      |
| `SEARCH_AUDIT_RETENTION_DAYS` | Search audit retention in days (minimum/default `30`)          |

Defaults and examples live in the root `.env.example`.

## Tests

No tests. Don't author unit, integration, or e2e tests unless explicitly requested.

## Conventions

- TS is strict (extends `tsconfig.base.json`).
- Module resolution is NodeNext — relative imports use `.js` extensions (e.g. `import { x } from './lib/x.js'` even when the source is `.ts`).
- Single quotes, tabs, no trailing commas.
- `unknown` in catches; narrow with `instanceof` / type guards.
- `import type` for type-only imports.
