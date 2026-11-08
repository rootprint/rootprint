# apps/api — Agent Guide

Hono backend on Bun: log ingest (NDJSON + OTLP), search proxy to Quickwit, users and auth, admin operations, and API keys (ingest, personal, service-account). `apps/web` calls it over HTTP.

## Where code goes

- `src/routes/`: one Hono router per resource, mounted with `app.route('/path', router)` in `src/app.ts`. `src/services/*.service.ts` hold the business logic routes call.
- `src/lib/`: one module or folder per external system, whether or not it does IO (Better Auth, Postgres, Quickwit, OpenAPI), plus `logger` and `secret`. `src/utils/`: helpers not built around one system. Two utils carry system knowledge because the error handler needs it everywhere: `http-error` maps Postgres unique violations and Better Auth API errors to `HttpError`, and `otlp-response` renders ingest results and `HttpError` as OTLP protobuf/JSON.
- `src/gen/` (protobuf output) and `proto/` (vendored upstream `.proto` files) are regenerated, never hand-edited: refresh `proto/` with the recipe and version pins in `proto/README.md`, then run `bun --filter api proto:gen` and review the diff.
- Database: app schema in `src/db/schema.ts`, Better Auth tables in `src/db/auth.schema.ts`, client in `src/lib/db.ts`, migrations in `drizzle/`. After a schema change, run `db:generate` and apply it locally with `db:migrate`.
- `bruno/` holds Bruno request collections for manual testing. When you add or change an endpoint, update the collection.

## Types Contract

- `src/types.ts` holds the types `apps/web` imports, exported via `exports['./types']` in `package.json`. Consumers import as `import type { IndexSummary } from 'api/types'`; server code imports those same types from `src/types.ts`. Request-input types inferred from request schemas (`CreateIndexInput`, `CreateUserInput`, …) are the exception: the web imports them from `api/schemas`.
- `types.ts` files are pure types only — no runtime exports.
- A server-only type lives where it is produced. A type inferred from a Valibot schema is exported from that schema's file (`export type X = v.InferOutput<typeof XSchema>`); a hand-written type is exported from the module that builds the value (`VerifiedApiKey` in `services/api-key.service.ts`). Move a type into `src/types.ts` only when `apps/web` needs it.
- The web also imports `api` (`AppType`), `api/schemas` (`src/schemas/index.ts`), `api/constants` (`src/constants.ts`), `api/query` (`src/lib/quickwit/query.ts`) and `api/time` (`src/lib/time.ts`). The last four are bundled into the browser build, so nothing they import at runtime may reach server-only modules (`config`, `lib/db`, `lib/quickwit/client`, …).
- Use `import type` for type-only imports.

## Routing & Request Handling

- Session-only routers (`admin/*`, `users`, `service-accounts`, `api-keys`, `shares`, `settings`) are wrapped in `withAuth()` in `app.ts`, which mounts `requireUser`; admin routers additionally mount `requireAdmin` themselves. Routers that mix session-only and bearer-key routes (`indexes`, `views`, `exports`, `traces`, `services`) mount `requireUser` or `requireUserOrPersonalKey` themselves, per router or per route. `mcp` mounts `requireUserOrPersonalKey` behind a bearer-only guard, so it never falls back to the cookie. Ingest routes use `requireIngestKey` from `require-api-key`.
- Read context values via `c.get('requestId' | 'session' | 'apiKey')`. The env types (`AppEnv`, `AuthedEnv`, `KeyedEnv`) live in `src/env.ts`.

## Error Handling

- Throw `HttpError` from `src/utils/http-error.ts` to signal HTTP-level failures.
- The central `app.onError` handler in `src/app.ts` translates errors:
  - Paths under `/v1/` get OTLP-style error responses (`otlpError`, `otlpErrorFromHttpError`).
  - Other paths get JSON `{ error: { code, message, statusCode, requestId } }`.
- Never return raw 500s with internal messages or stack traces.
- Let a `QuickwitError` propagate: `app.onError` maps it with `quickwitErrorToHttp` (`lib/quickwit/errors.ts`). To map it earlier inside a catch, use `translateQuickwitError` or `withNotFound` from the same file; that file is the only Quickwit-to-HTTP mapper.
- The web branches on `error.code` and `details[].path` (`queryErrorOf`, `toFieldErrors` in `apps/web/src/lib/api/`). Changing either for an endpoint is a contract change: find its web consumers.
- Every Quickwit search passes `{ signal: requestSignal() }` (`lib/quickwit/client.ts`), so it stops when the client hangs up and rejects with the signal's own reason. `isHangup(err)` matches exactly that error: `app.onError` answers it with 499 and no fault, `withSearchAudit` records it as `cancelled` with no error (kept out of every activity stat) and `runTool` stays quiet. A real fault that lands while the client leaves is still a fault.

## Logging

pino on stdout, configured in `src/lib/logger.ts`: ISO `time`, string `level`, `service.name` and `service.version` on every line. A mixin adds `http.request.id` to any line written during a request (Hono `contextStorage()`), so never pass a request id by hand.

- One line per API request, and per failed page or asset request, written by `requestLogging` (`src/middleware/request-logging.ts`). To put something on it (an index, counts, an error code), call `addLogAttrs(c, { … })`; don't write a second line for the same request. `app.onError` adds `error.type`, `err` for faults (a 5xx without `retryAfter`, or a non-`HttpError` throw) and `error.message` from a transient error's `cause`.
- Level follows the line: `err` → `error`; 499 (client hung up) → `info`; status ≥ 400 or rejected ingest records → `warn`; `/api/health` → `debug`; else `info`.
- Field names: the OpenTelemetry semantic-convention name when one exists (`http.route`, `user.id`, `error.type`, `url.full`), else ECS (`http.request.id`), else a `rootprint.` prefix (`rootprint.index.id`). Durations are `duration_ms`. Errors stay under pino's `err`. A field keeps one type everywhere (`rootprint.api_key.id` is always a string).
- Messages outside the request line are short lowercase event phrases (`field caps failed — falling back to schema`).
- When wrapping an upstream failure in an `HttpError`, attach the original as `cause` (`internal` and `serviceUnavailable` take one) so the line says why.
- Never log secrets: API keys, tokens, session cookies, client secrets.

## Validation

- Use Valibot for all external input (request bodies, query params, headers). Routes validate through the `validator` wrapper in `lib/openapi/describe.ts`, which throws `HttpError(400, 'VALIDATION_FAILED')` with one `details` entry per issue.
- Audited searches (log search and every span read) go through the `read*` operations in `services/search-audit.service.ts`, which the routes and the MCP tools share. Their cross-field checks live there, not in the schemas: `startTs < endTs`, `minMs < maxMs`, and balanced parentheses in the explore `q` (inside `exploreQuery`, where it is spliced). They answer `400 BAD_REQUEST` with the reason as the message (the parentheses check also carries a `q` entry in `details`, which the explorer's `queryErrorOf` needs to show it in the query box), and run before the audit, so a rejected search writes no audit row.
- Infer TS types from Valibot schemas where possible (`v.InferOutput<typeof Schema>`).
- Request schemas live in `src/schemas/<resource>.ts` (shared path-param schemas in `src/utils/params.ts`); response schemas in `src/schemas/responses/<resource>.ts`. Route files never define schemas inline — they import them.

## Authentication

- Better Auth setup lives in `src/lib/auth.ts`. Database tables follow Better Auth's schema (`src/db/auth.schema.ts`).
- Session-based auth (cookies) for the web app; ingest API keys for log producers (`requireIngestKey` in `src/middleware/require-api-key.ts`).
- Log and trace reads (index list, index fields and config, log search, histogram, field values, `/api/traces`, `/api/services`) additionally accept a personal or service-account bearer key via `requireUserOrPersonalKey` (`src/middleware/require-user-or-personal-key.ts`), falling back to the session cookie when no bearer is present. Export, saved views and index preferences are session-only.
- `POST /api/mcp` is a stateless MCP server (Streamable HTTP, JSON responses) exposing those same reads as seven read-only tools (`services/mcp.service.ts`). It is bearer-only: no cookie fallback (`401 BEARER_REQUIRED`). Every tool handler runs through `runTool`, which masks errors with the same rule as `app.onError` (`isPublicError`) — a thrown error would otherwise reach the agent with its raw message. Tool input schemas are published as JSON Schema, so they cannot use `v.check`, `v.transform` or `v.trim`.
- MCP accepts one JSON-RPC message per POST. Batches are rejected with HTTP 400 (`-32600`) before any tool runs, keeping the shared per-actor read quota aligned with tool calls. Bodies retain the SDK's default 4 MiB limit.
- Google, GitHub, and one generic OpenID Connect provider are configured at runtime via the admin settings UI (writes to `app_settings`). Google and GitHub env vars (`GOOGLE_CLIENT_ID` etc.) are **not** read. OIDC reads `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` first (`oidcFromEnv` in `services/settings.service.ts`, on every call): all three or none, validated by `oidcCredentialsSchema`, and a partial or invalid set fails the auth build, so boot. While they are set they win over `app_settings` and are never written there; boot deletes any UI-saved `oidc_*` credentials, so removing the vars turns OIDC off instead of reviving an older provider. The status route reports `managedByEnv: true`, and the OIDC credential PUT/DELETE answer `409 OIDC_MANAGED_BY_ENV`. Better Auth is rebuilt with `reloadAuth()` after credential and password-toggle writes only; allow-list writes are read from the DB at each OAuth sign-in and do not reload.
- Google sign-in is gated by a domain allowlist; GitHub sign-in by an org allowlist. Both live in `app_settings` and are enforced in `user.validateUserInfo` (`lib/auth.ts`), which Better Auth runs on every OAuth create, link, and repeat sign-in before any row is written. The GitHub verdict is computed in a `getUserInfo` wrapper (the hook never sees the access token) and carried on the profile as `orgAllowed`. If creds are present but the allowlist is empty or missing, all sign-ins for that provider are rejected and the providers endpoint reports it disabled. Nothing re-checks a provider during a session: a removed domain or org takes effect at the user's next sign-in. OIDC has no app-side allowlist: the IdP decides who may sign in. The IdP must echo the nonce and support PKCE (both required by the plugin config), and ID token signatures are verified against the discovered JWKS (`requireIdTokenVerification`). `oidc` is a trusted provider like Google and GitHub (see the comment in `lib/auth.ts`). OIDC `accountId` is `<issuerUrl>|<sub>`.
- The issuer URL must be `https:`, or `http:` on a private network (`isHttpsOrPrivate` in `schemas/settings.ts`) — the token endpoint carries the client secret. The discovered endpoints must pass the same check, and an `https:` issuer may not downgrade any of them to `http:`. Discovery is fetched on save and again at each Better Auth build. The build probes the issuer with the same 5 s check and omits the provider when it fails (`loadReachableAuthConfig` in `lib/auth.ts`); a retry runs a minute later, so an unreachable issuer leaves OIDC off rather than stalling the auth path.
- `password_sign_in_disabled` closes `/sign-in/email` via `disabledPaths`. Nothing checks that an external provider is configured or working first — an admin can lock themselves out. Break-glass: delete that row, then restart the API or re-save provider credentials so `disabledPaths` is rebuilt; if the admin has no credential row, insert an `invite_token` row and open `/auth/setup?token=…`.
- Linking a provider (`google`, `github`, `oidc`) to a user deletes any pending invite and nothing else; any credential row survives, so a password user keeps their password. Account linking is auto-enabled for configured providers with `requireLocalEmailVerified: false`, so an invited user who has not set a password can complete onboarding through a provider.
- Deleting a provider's credentials revokes the sessions of every user with an account row for that provider, in the same transaction. Deleting OIDC credentials, or saving them with a different issuer URL or client ID, also deletes the `oidc` account rows; users re-link by email at their next sign-in or get a password from an admin reset. A change of the `OIDC_*` issuer or client ID, including setting or removing the vars, does the same at boot: `initAuth` runs `syncOidcEnvIdentity`, which compares them with the `oidc_env_identity` row. `reloadAuth()` skips it, so a rolling update's old pod cannot undo the new pod's sync. Personal API keys are untouched. An OAuth callback already in progress may still complete.
- Admin password reset and invite reissue work for any human user. `setupPassword` transactionally consumes the invite, replaces every existing credential row with exactly one newly hashed credential, and verifies the email. Users created by an admin start without a credential row and can instead complete onboarding through a configured provider.
- No session cookie cache: every authenticated request reads the session from the database, so demotion and revocation apply on the next request. The legacy ban columns remain in the database but are unused. OAuth access and refresh tokens are stored encrypted (`account.encryptOAuthTokens`). `reloadAuth()` is serialized within one process; runtime auth rebuilding and in-memory rate limiting assume a single API process.
- Better Auth's admin plugin is not installed. `/api/users` and `/api/service-accounts` are the only user-management admin HTTP surface, and their four management operations use direct database queries.

## Traces

- Spans live in one Quickwit index, the span store, named by `config.traceIndexId` (env `TRACE_INDEX_ID`). The default `otel-traces-v0_9` tracks the **Quickwit** version. A wrong value fails silently: `getTrace` treats a missing index as an empty trace so a logs-only cluster doesn't error, which means a typo looks like "no spans" rather than a misconfiguration.
- The `/traces` explorer searches spans: `GET /api/traces/explore/spans` returns matching spans and `GET /api/traces/explore/overview` returns span charts, operations and filter choices (both in `services/trace-explore.service.ts`). `GET /api/traces/:traceId` retrieves one trace, and `GET /api/services` returns aggregate service-health data from server spans. A trace is also reached from a log carrying its id, or by pasting the id into the log search box.
- `GET /api/traces/:traceId` is a raw `trace_id:<hex>` search with **no time range**, not Quickwit's Jaeger API — that API forced a `now - lookback_period_hours` window (72h default), making older traces findable but unopenable. Capped at `MAX_TRACE_SPANS`; past the cap the earliest spans are kept (the query sorts by `span_start_timestamp_nanos` ascending) and `truncated` is set.
- **Trace ids are not authorization.** `/api/traces` is a top-level mount, not nested under an index, so there is no per-index gate: any user or personal key with `logs:read` can read any trace. That matches log search, where the same holds for any index.
- The span store is not readable as a log index — `assertNotTraceIndex` in `getIndexConfig` 404s it, so log-explorer, histogram, field-values, and export all reject it. `isTraceIndex` on `IndexSummary`/`IndexDetail` is derived from `config.traceIndexId`, not stored.
- `POST /v1/traces` routes to `config.traceIndexId` for **every** ingest key, whatever log index it was created against — no per-key destination exists. `createApiKey` refuses to anchor a key to the span store (`400 INDEX_IS_TRACE_INDEX`), which would let it write log documents there.

## Environment Variables

The root `.env.example` documents every variable and its default. Parse a new variable in `src/config.ts` and document it in `.env.example`.

## Tests

`tests/` is an HTTP-level suite for authentication. `bun test` (via `bun --filter api test`) preloads `tests/preload.ts`, which boots the real app against `rootprint_test` on the local Postgres and the real Quickwit from `docker compose` (host port 7280), then serves it on port 18282. Each file calls `resetDb()` in `beforeEach`. Helpers live in `tests/helpers/`: `Jar` (cookie jar with its own client IP), `fixtures.ts` (admin, members, invites), `fake-idp.ts` (OIDC provider), `providers.ts` (Google/GitHub fetch mocks). The preload sets `NODE_ENV=production` because Better Auth disables its origin/CSRF check under `NODE_ENV=test`. A failing test against unchanged behaviour is a finding: report it, do not bend the assertion.
