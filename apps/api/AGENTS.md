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

| Path               | Purpose                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.ts`       | Hono app composition, middleware mount, error handler, SPA static serving, boot (`main()`)                                                                                                                                      |
| `src/config.ts`    | Resolved runtime config object                                                                                                                                                                                                  |
| `src/env.ts`       | Hono context types: `AppEnv` (`requestId`, `session?`, `apiKey?`), `AuthedEnv`, `KeyedEnv`                                                                                                                                      |
| `src/types.ts`     | Public, pure-type surface re-exported via `exports['./types']`                                                                                                                                                                  |
| `src/index.ts`     | Workspace package entry                                                                                                                                                                                                         |
| `src/routes/`      | One file per resource (`api-keys`, `auth`, `exports`, `health`, `indexes`, `service-accounts`, `settings`, `shares`, `users`, `views`); `routes/admin/` (`activity`, `cluster`, `metrics`); `routes/ingest/` (`ndjson`, `otlp`) |
| `src/services/`    | `*.service.ts` — business logic called from routes                                                                                                                                                                              |
| `src/middleware/`  | `request-context`, `require-user`, `require-admin`, `require-api-key`, `require-user-or-personal-key`, `with-index-config`, `with-index-meta`                                                                                   |
| `src/schemas/`     | Valibot request schemas per resource; response schemas under `schemas/responses/`                                                                                                                                               |
| `src/db/`          | Drizzle schemas (`schema.ts`, `auth.schema.ts`) and DB client (`index.ts`)                                                                                                                                                      |
| `src/lib/`         | Cross-cutting clients and IO: `auth`, `auth-admin`, `db`, `quickwit`, `quickwit-proxy`, `quickwit-metrics`, `secret`, `openapi/`, `query/`                                                                                      |
| `src/utils/`       | Pure helpers: `http-error`, `quickwit-error`, `otlp-response`, `bearer`, `params`, `valibot`, `require-env`, `db`                                                                                                               |
| `src/gen/`         | Generated protobuf code — **do not edit**                                                                                                                                                                                       |
| `src/constants.ts` | Domain constants                                                                                                                                                                                                                |

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
- Google and GitHub OAuth are configured at runtime via the admin settings UI (writes to `app_settings`). Provider env vars (`GOOGLE_CLIENT_ID` etc.) are **not** read.
- Google sign-in is gated by a domain allowlist; GitHub sign-in by an org allowlist. Both live in `app_settings`. If creds are present but the allowlist is empty or missing, all sign-ins for that provider are rejected.
- Linking an OAuth account to a user deletes that user's credential row and any pending invite. Account linking is auto-enabled for configured providers — an existing user signing in via OAuth for the first time gets attached to their existing row instead of getting a duplicate.

## Environment Variables

Required:

| Var            | Purpose                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL` | Postgres connection string                                                    |
| `ORIGIN`       | Canonical public URL used for auth callbacks, invite links, CORS, and cookies |
| `QUICKWIT_URL` | Quickwit REST endpoint (e.g. `http://localhost:7280`)                         |

Optional:

| Var                  | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Override the auto-generated Better Auth signing secret         |
| `FRONTEND_URL`       | Additional allowed CORS origin for split SPA + API deployments |
| `PORT`               | Override the HTTP listen port (default `8282`)                 |

Defaults and examples live in the root `.env.example`.

## Tests

No tests. Don't author unit, integration, or e2e tests unless explicitly requested.

## Conventions

- TS is strict (extends `tsconfig.base.json`).
- Module resolution is NodeNext — relative imports use `.js` extensions (e.g. `import { x } from './lib/x.js'` even when the source is `.ts`).
- Single quotes, tabs, no trailing commas.
- `unknown` in catches; narrow with `instanceof` / type guards.
- `import type` for type-only imports.
