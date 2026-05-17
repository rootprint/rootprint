# apps/api — Agent Guide

## About

Hono backend on Bun. Responsibilities: log ingest (NDJSON + OTLP), search proxy to Quickwit, user/auth, admin operations, ingest tokens. In single-container mode (`LOGWIZ_SERVE_WEB=true`), Hono also serves the static `apps/web` build.

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

| Path              | Purpose                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app.ts`      | Hono app composition, middleware mount, error handler                                                                                            |
| `src/config.ts`   | Resolved runtime config object                                                                                                                   |
| `src/env.ts`      | `AppEnv` type (Hono context: `requestId`, `session`, `token`)                                                                                    |
| `src/types.ts`    | Public, pure-type surface re-exported via `exports['./types']`                                                                                   |
| `src/index.ts`    | Workspace package entry                                                                                                                          |
| `src/routes/`     | One file per resource (`logs.ts`, `indexes.ts`, `users.ts`, `tokens.ts`, `auth.ts`, `health.ts`); `routes/ingest/` for `ndjson.ts` and `otlp.ts` |
| `src/services/`   | `*.service.ts` — business logic called from routes                                                                                               |
| `src/middleware/` | `request-context`, `require-user`, `require-admin`, `require-token`                                                                              |
| `src/db/`         | Drizzle schemas (`schema.ts`, `auth.schema.ts`) and DB client (`index.ts`)                                                                       |
| `src/lib/`        | Cross-cutting clients: `auth`, `db`, `quickwit`                                                                                                  |
| `src/utils/`      | Pure helpers: `http-error`, `otlp-response`, `bearer`, `ingest-token`                                                                            |
| `src/gen/`        | Generated protobuf code — **do not edit**                                                                                                        |
| `src/constants/`  | Domain constants (e.g. `ingest.ts`)                                                                                                              |

Sibling top-level dirs:

- `proto/` — vendored upstream `.proto` files (OTEL, googleapis). Don't edit; refresh via the recipe in `proto/README.md`.
- `drizzle/` — generated SQL migrations.
- `bruno/` — Bruno API request collections for manual testing.
- `buf.yaml`, `buf.gen.yaml` — buf configuration.
- `drizzle.config.ts`, `vitest.config.ts` — config files (note: `vitest.config.ts` is currently dead; see follow-ups).

## Types Contract

- Public, cross-workspace types go in `src/types.ts` and are exported via `exports['./types']` in `package.json`. Consumers import as `import type { LogHit } from 'api/types'`.
- `src/types.ts` is pure types only — no runtime exports.
- Internal helper types live alongside the code that uses them. Move a type to `src/types.ts` only when more than one workspace needs it.

## Routing & Request Handling

- Each resource gets a `Hono` router and is mounted with `app.route('/path', router)` in `src/app.ts`.
- Auth-protected routers wrap via the `withAuth()` helper, which mounts `requireUser`/`requireAdmin`/`requireToken` middleware.
- Read context values via `c.get('requestId' | 'session' | 'token')`. The `AppEnv` type lives in `src/env.ts`.

## Error Handling

- Throw `HttpError` from `src/utils/http-error.ts` to signal HTTP-level failures.
- The central `app.onError` handler in `src/app.ts` translates errors:
  - Paths under `/v1/` get OTLP-style error responses (`otlpError`, `otlpErrorFromHttpError`).
  - Other paths get JSON `{ error: { code, message, statusCode, requestId } }`.
- Never return raw 500s with internal messages or stack traces.

## Validation

- Use Valibot for all external input (request bodies, query params, headers). The `app.onError` handler maps `ValiError` to a 400 with a structured detail list.
- Infer TS types from Valibot schemas where possible (`v.InferOutput<typeof Schema>`).

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
- Session-based auth (cookies) for the web app; ingest tokens for log producers (`require-token` middleware).
- Google OAuth is configured at runtime via the admin settings UI (writes to `app_settings`). The `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars are **not** read.
- Google sign-in is gated by a domain allowlist stored in `app_settings.google_allowed_domains` (JSON-encoded `string[]`). If creds are present but the allowlist is empty or missing, all Google sign-ins are rejected.
- Linking a Google account to a user deletes that user's credential row and any pending invite. Account linking is auto-enabled (Google is a trusted provider) — an existing user signing in with Google for the first time gets attached to their existing row instead of getting a duplicate.

## Environment Variables

Required:

| Var                  | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`       | Postgres connection string                                         |
| `QUICKWIT_URL`       | Quickwit base URL (e.g. `http://localhost:7280`)                   |
| `BETTER_AUTH_SECRET` | Better Auth signing secret                                         |
| `BETTER_AUTH_URL`    | Public base URL of the API (e.g. `http://localhost:8282`)          |
| `FRONTEND_URL`       | Allowed CORS origin for the web app (e.g. `http://localhost:5173`) |

Optional:

| Var                | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `HOST`             | Bind host (default `0.0.0.0`)                                            |
| `PORT`             | Bind port (default `8282`)                                               |
| `LOGWIZ_SERVE_WEB` | When `true`, serve `apps/web` static build from Hono                     |
| `LOGWIZ_WEB_ROOT`  | Directory containing the web static build (used with `LOGWIZ_SERVE_WEB`) |

Defaults and examples live in the root `.env.example`.

## Tests

No tests. This workspace currently has a stale `vitest.config.ts` left over from a prior experiment — it has no `vitest` dependency and no `test` script. Don't author tests; see follow-ups.

## Conventions

- TS is strict (extends `tsconfig.base.json`).
- Module resolution is NodeNext — relative imports use `.js` extensions (e.g. `import { x } from './lib/x.js'` even when the source is `.ts`).
- Single quotes, tabs, no trailing commas.
- `unknown` in catches; narrow with `instanceof` / type guards.
- `import type` for type-only imports.
