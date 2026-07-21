# Changelog

All notable changes to Rootprint are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.6] - 2026-07-21

### Added

- **Query autocomplete.** The search bar suggests field names and completions as you type, with refined field-completion details and a subtle highlight for the active suggestion.
- **Empty-state onboarding.** A fresh cluster with no documents yet shows a getting-started screen instead of a blank search, pointing admins toward **Settings → Send logs**.
- **Richer log context drawer.** A new context tab lets you pick which fields make up a log's context, with per-field scope toggles and a set of default context fields. Context rows open their log in place, and a dedicated traceback tab surfaces stack traces.
- **API rate limiting.** The API now rate-limits requests to protect the backend.
- **Structured API request logging.** Requests are logged in a structured format for easier searching and diagnostics.
- **Dynamic field mapping.** Indexes support dynamic mapping, alongside a simpler web UI for it.
- **Documentation links in Send logs.** The Send logs integrations link out to their setup docs.
- **Dependabot.** Dependency updates are now proposed automatically.

### Changed

- **Timestamps drop the timezone mode.** Web timestamps render in a single, consistent scheme.
- **Message fields and column settings backfilled** with sensible defaults; empty inline log parts are filtered out.
- **Internal (api):** API schemas and services were refactored, and the ingest-source logic was split out of the index service into its own service with a shared field-name schema.
- **Dependency updates,** including bun 1.3.14, TypeScript 6, and several GitHub Actions.

### Fixed

- **Frequency chart tooltip** no longer reads out of bounds at the chart edges.
- **Log drawer rows** use stable rendering keys, fixing list update glitches.

## [0.3.5] - 2026-06-21

### Added

- **Index creation and editing from the admin UI.** Admins create and edit indexes under **Settings → Indexes** without touching Quickwit. A guided form covers the index ID, document mapping (through a new field-mappings editor), search settings, and retention, backed by new index create/update API routes.
- **Personal API keys.** Each user mints their own search keys under **Account → API keys**, and the secret shows once on creation. These keys replace the old shared search-role tokens (see _⚠️ Breaking_).
- **Service accounts.** Admins create non-human service accounts under **Security → Service accounts** and issue API keys scoped to them, which keeps automation separate from real user accounts. The UI documents API-key roles and their use.
- **Kafka ingest source.** Index ingest sources now support **Kafka** alongside Kinesis and file (SQS/S3-notification), configured from the source forms.
- **OpenTelemetry Collector and Kubernetes send-logs integrations.** **Settings → Send logs** gains two integrations, plus an origin search to find one as the catalog grows.
- **Filters saved with views and shares.** Saved views keep the full result setup: query, filters, sort direction, and column layout. Shared links carry their filters too, so a recipient opens the same filtered result (migrations `0012`, `0014`).
- **Admin-aware index listings.** Index views account for admin scope, so admins see every index.

### ⚠️ Breaking

- **Existing search API keys stop working.** We removed the shared "search" API-key role. Read access now comes only from **personal API keys** (one per user) or **service account** keys (for automation). Migration `0013` deletes every search-role key and drops its `token` audit history. **Action required:** before you upgrade, reissue credentials. Have each user create a personal key under **Account → API keys**, or create a service account under **Security → Service accounts** and issue it a key, then point every log shipper, script, and integration that read with an old search key at the new one. Ingest keys keep working.

### Changed

- **Saved queries became saved views.** Views store the full result setup (query, filters, sort, columns) under one API and a new `ViewsDropdown`. The migration carries existing saved queries over.
- **File ingest source labelled "SQS."** The UI and API call file-notification sources SQS throughout.
- **Web app reorganized into feature folders,** and the OAuth provider setup forms collapse into one shared form.
- **Internal (api):** we split error translation/logging, index-metadata access middleware, and request/response schemas into dedicated modules, and expanded OpenAPI output and field-values metadata.
- **UI polish.** Tidied the API-key dropdown layout, sidebar row borders, and collapsed sidebar groups. A mobile gate points small-screen users to a desktop browser.

### Fixed

- **Clipboard copy inside modal dialogs.** Copy buttons, such as the one-time key reveal, now work inside a modal.
- **Log viewer hardened against invalid data.** Malformed log entries no longer break rendering.
- **API security and admin error handling hardened** across ingest, index access, sharing, and several admin forms.

## [0.3.4] - 2026-06-06

### Added

- **GitHub OAuth sign-in.** GitHub joins Google as a configurable authentication provider, managed from **Security → Authentication**. Admins enter a GitHub OAuth app's client ID and secret and can restrict sign-in to members of one or more allowed GitHub organizations (org membership is checked against the GitHub API at login). A dedicated provider page handles setup, and a confirmation modal handles removal.
- **Quickwit ingest source management.** Indexes can now have their ingest sources created and edited from the admin UI (**Settings → Indexes → _index_ → Sources**). Both **Kinesis** and **file** (SQS/S3-notification) source types are supported, with per-source controls for input format (JSON, plain text, and the OTLP logs/traces JSON and protobuf variants), pipeline count, and an optional VRL transform script. A source summary view surfaces the current configuration at a glance.
- **Build information in API responses.** Quickwit build/version details are now included in the relevant admin API responses and shown on the admin overview's cluster identity strip.

### Changed

- **Cluster connection-state handling reworked.** The `ClusterIdentityStrip` and admin overview were updated to handle and present the Quickwit connection state more clearly.

## [0.3.3] - 2026-06-04

### Added

- **Compressed NDJSON ingest.** The NDJSON ingest route now forwards the incoming `content-encoding` header to Quickwit, so gzip-compressed NDJSON bodies are ingested correctly instead of being mis-parsed.

### Changed

- **Node.js log-shipping examples modernized.** The Node.js OpenTelemetry and Winston "send logs" snippets now attach a detected resource (picking up `service.name` and `OTEL_RESOURCE_ATTRIBUTES` from the environment via `@opentelemetry/resources`), use the current `LoggerProvider({ resource, processors })` constructor form, and shut the provider down cleanly on exit.
- **Internal (web):** query and UI helpers consolidated (#24). Admin-overview metrics polling was extracted into a dedicated `MetricsPoller` class; a shared `windowToSpanMs` helper replaces the duplicated window-to-milliseconds maps; admin API calls now surface server error messages through `readApiError`; and shared `isPlainObject` / `setSearchParam` / `copyWithToast` helpers were introduced. `composeQuery` now returns `*` (match-all) for empty input directly, so callers no longer carry a `|| '*'` fallback. Dead helpers (`formatLatencyMs`, `formatRatePerSecond`, `timeRangeDurationMs`, and the `cn` class-merge util) were removed.

### Removed

- **Unused shadcn-svelte scaffolding (web).** Removed `components.json`, the `clsx`, `tailwind-merge`, `tailwind-variants`, and `tw-animate-css` dependencies, and their leftover CSS (the `tw-animate-css` import plus the `@custom-variant dark` and unused `@theme inline` color aliases).

## [0.3.2] - 2026-06-02

### Added

- **Profile settings page.** A new **Account → Profile** section lets every user view their identity (name, email, ID) and change the password they sign in with, via a dedicated change-password modal. The password controls are hidden for users who only sign in through Google.
- **Admin user profile page.** Administrators can open an individual user from **Security → Users** to see their full profile details on a dedicated page.
- **Role filter tabs on the API keys page.** The API keys list can now be filtered by role with a tab strip.
- **OpenAPI documentation for the API.** The Hono API now generates an `openapi.json` spec at build time (`bun run openapi:generate`) using `hono-openapi` and `@valibot/to-json-schema`. Route descriptions, standardized response schemas, and consistent error shapes were added across the API, and the Better Auth routes are folded into the same spec.

### Changed

- **Export dialog and log-row polish.** The export dialog styling was refined, and log rows now tint their hover state with the entry's level color.
- **Admin role badges** restyled to a neutral appearance.
- **Profile settings layout widened** for more comfortable reading.
- **Activity view reworked.** The admin activity screen was rebuilt around a new `ActivityPanel`, replacing the previous `ActivityTable`.

### Removed

- **Slowest-query activity views.** The "slowest queries" panels and their backing `search-activity` service were removed, along with the standalone per-user activity detail page (user details now live on the admin user profile page).

### Fixed

- **Container crashed on startup** (`ENOENT: open '/package.json'`). The OpenAPI spec reads the workspace-root `package.json` for its version, but that file was not present in the runtime image. The Docker image now ships it so the API boots. _(Re-released; the initial 0.3.2 image was affected.)_

## [0.3.1] - 2026-06-02

### Added

- **Display mode and line-wrap preferences.** Two new per-user display settings: a **table / inline** display mode for results and a **line-wrap** toggle for log rows, persisted in `user_preference` (migration `0011`). The former **Column settings** panel is now **Display settings**.
- **Hidden index support.** Indexes can be marked hidden, with a new `require-manageable-index` middleware gating index management and access accordingly.
- **Embedded JSON resolution in the log detail drawer.** String field values whose content is itself a JSON object or array are now parsed into real nested JSON (recursively, depth-capped) before the JSON tab pretty-prints them. Scalar-looking strings are left untouched so they are not coerced to other types.

### Changed

- **Drawer search highlighting now uses the CSS Custom Highlight API** instead of wrapping matches in DOM nodes. The `HighlightedText` component was replaced by `dom-highlight.ts`.
- **Charts migrated from LayerChart to uPlot.** The latency, volume, and storage-trend charts were reimplemented on uPlot, and the bespoke `ui/chart/*` wrapper components were removed.
- **Admin users list layout refined**, alongside updated send-logs integration examples and documentation.
- **Internal (API):** all backend constants consolidated into a single `constants.ts`; search and export parameters refactored, with shared types expanded in `types.ts`.
- **Internal (web):** dependency-invalidation keys reworked (`api/deps.ts`, new `request-guard` store) with consolidated error handling across loaders and components.

### Upgrade notes

1. Migration `0011` applies on startup. It adds `line_wrap` and `display_mode` columns to `user_preference`, both with defaults — no manual action required.

## [0.3.0] - 2026-05-31

Complete architectural rewrite. Rootprint is now a Bun-workspace monorepo: a standalone **Hono API** (`apps/api`) and a separate **SvelteKit SPA** (`apps/web`) that talks to it over HTTP. The previous single SvelteKit-server deployment is gone, and the datastore has moved from SQLite to **PostgreSQL**.

### ⚠️ Breaking changes

- **New two-process architecture.** The monolith is split into an API server (`apps/api`) and a static web client (`apps/web`). You now deploy and run the API as its own service; the web app is served as static assets.
- **PostgreSQL replaces SQLite.** Persistence moved from `sqlite.db` to PostgreSQL (Drizzle + `pg`). There is no in-place migration from the old SQLite database — this is a fresh schema. Provision a Postgres instance and run `bun run db:migrate` against it before starting the API.
- **Configuration changes.** The API requires a Postgres connection and a resolvable `ORIGIN`. Review `.env.example` and update your deployment.

### Upgrade notes

Because the storage engine changed, **0.3.0 is not an in-place upgrade from 0.2.x.** Stand up a new deployment:

1. Provision PostgreSQL and set the connection string (see `.env.example`).
2. Deploy `apps/api` as a service and run `bun run db:migrate`.
3. Build and serve `apps/web` (static) pointed at the API's `ORIGIN`.
4. Recreate ingest tokens and re-add users; data is not carried over from the SQLite database.

## [0.2.2] - 2026-04-25

### Added

- **Index stats strip expanded to four cards.** The header on the index detail page now shows **Last ingest**, **Ingestion · 24h**, **Index size**, and **Growth · 7d avg**. The 24-hour and 7-day cards are computed from a new background snapshot job (`index-stats-snapshot.ts`) that captures Quickwit's `describeIndex` output every 5 minutes and prunes rows older than 35 days. New deployments display `—` / `collecting data` until enough history is available.
- **Trace ID button in the log detail drawer.** Click the trace ID in an expanded log entry to copy it to the clipboard, with a paired clipboard-failure announcement for assistive tech.
- **Repository hygiene.** GitHub issue templates (bug report, feature request) and a pull request template, plus `CODE_OF_CONDUCT.md` and `SECURITY.md`.

### Changed

- **Field-mapping defaults are now universal.** Previously, only indexes with IDs starting with `otel-logs-` received OpenTelemetry-friendly defaults (`severity_text` / `body.message` / `attributes.exception.stacktrace`); other indexes fell back to `level` / `message` / empty. Every index now uses the OTel-friendly defaults until you save explicit settings in **Administration → Indexes → Configuration**. Existing indexes with saved settings are unaffected.
- **Password-reset gating moved from Google-presence to credential-presence.** **Reset password** and self-serve password change are now disabled when a user has no credential account (i.e. has only ever signed in via Google). Users who have both a Google and a credential account can now reset their password normally — previously the linked Google account blocked the action. A new `user.has_credential_account` column tracks this.
- **Log detail drawer rework.** Refactored layout, value-cell styling, and copy interactions for better readability and accessibility.
- **Internal:** `indexes_meta` table renamed to `index_settings`; ingest gateway and OTLP route extracted bearer parsing into `$lib/server/utils/bearer.ts`; Quickwit client and several services moved from a factory to a singleton import.

### Fixed

- **Inflated 24-hour ingestion metrics.** The previous calendar-aligned histogram could over-report the 24-hour count when snapshot history had gaps. The redesigned card uses snapshot deltas with a tight ±1h anchor window so missing history yields `—` rather than a misleading multi-day total.
- **Removed a `console.log` that leaked user IDs** during the Google account-linking flow.

### Removed

- Unused `IndexPicker.svelte` component.

### Upgrade notes

1. Back up `sqlite.db` before running migrations.
2. Migrations `0031`–`0033` will apply on startup. They rename `indexes_meta` → `index_settings` and add `user.has_credential_account` (back-filled from existing `account` rows).
3. If your index visibility/field configuration was relying on the previous `level` / `message` defaults for non-OTel indexes, save explicit settings on those indexes from **Administration → Indexes → Configuration** before upgrading.

## [0.2.1] - 2026-04-20

### Changed

- **OTLP endpoint is protobuf-only.** `/api/otlp/v1/logs` now returns `415` for `Content-Type: application/json` (previously the request was forwarded and Quickwit returned an opaque `400`). Users of `@opentelemetry/exporter-logs-otlp-http` (which defaults to JSON) should switch to `@opentelemetry/exporter-logs-otlp-proto`. JavaScript integration guides (docs and admin UI) have been updated to use `@opentelemetry/exporter-logs-otlp-proto`.

### Fixed

- **Docker log-shipping guide (docs and `/administration/send-logs/docker`).** The previous OpenTelemetry Collector config relied on the `container` operator emitting `container.name`, but the `docker` format only emits `log.iostream` and the parsed timestamp — so the `filter/exclude_self` processor never matched and the self-exclusion loop guard was a no-op. The config now derives `container.id` from the log file path with a `transform` processor and matches the filter against `${env:HOSTNAME}` (Docker's default short container ID) instead. `service.name` falls back to the container ID when an app hasn't set one itself.
- **Docker log-shipping guide — permission denied.** Added `user: "0:0"` to the collector compose service. The `otel/opentelemetry-collector-contrib` image runs as UID 10001 by default, which cannot read `/var/lib/docker/containers`.
- **Docker log-shipping guide — noisy parser errors.** Added `on_error: send_quiet` to the `container` operator. The operator's k8s-metadata step runs a regex that matches only pod log paths and fails loudly on Docker paths; entries are still forwarded, but the error logs are now suppressed.
- **Docker log-shipping guide — dropped an unneeded Docker socket mount.** `/var/run/docker.sock` was mounted in the compose snippet but never actually read by the `container` operator.

## [0.2.0] - 2026-04-20

Major release reshaping the administration experience, adding first-class log-ingestion guides, and introducing marketing + documentation sites.

### ⚠️ Breaking changes

- **Ingest tokens are wiped on upgrade.** Migration `0030_rework_ingest_token.sql` rebuilds the `ingest_token` table: tokens are now stored in plaintext (so they can be re-shown in the UI) and each token is scoped to exactly one index. Previous hashed tokens cannot be recovered, so **all existing rows are deleted** — recreate any tokens after upgrading.
- **Default HTTP port changed to `8282`.** Update reverse proxies, firewall rules, and any compose overrides that relied on the previous default.
- **Admin routes moved.** `/administration` is now a section with its own sidebar — `/administration/users`, `/administration/tokens`, `/administration/indexes`, `/administration/authentication`, `/administration/send-logs`. Deep links into the previous single-page layout need updating.
- **Auth flow change.** First-run `/auth/change-password` is replaced by `/auth/setup-admin`.

### Added

- **Administration**
  - New admin layout with sidebar navigation and breadcrumbs
  - Per-user role management from the users table
  - Member actions menu for user moderation
  - Dedicated Authentication section with Google provider form
  - Index management UI: delete index, manage sources, view/edit config, per-index stats
  - Ingest token management UI: create, view (plaintext), delete; tokens scoped to a single index
- **Send Logs**
  - New `/administration/send-logs` section with copy-pasteable integration guides for Python, Go, Java, JavaScript, .NET, Docker, and plain HTTP
  - OTLP HTTP endpoint at `/api/otlp/v1/logs` for OpenTelemetry exporters
- **Indexes**
  - Index detail page rework with tabs: Overview, Fields, Sources, Configuration
  - Index stats row highlights ingestion drops
  - Searchable index list
- **Sites**
  - Marketing site under `site/` (deploys to GitHub Pages)
  - Mintlify docs site under `docs-site/` covering install, configuration, index management, and send-logs guides

### Changed

- Service layer split: new `index-stats.service.ts` and `quickwit-index.service.ts`
- Reusable UI primitives: `Modal`, `ConfirmModal`, `Callout`, `CodeBlock`, `InlineCode`
- Constants reorganised under `src/lib/constants/`
- Config loading and validation refactored
- Ingest token revocation is now deletion
- Config tab renamed to "Index Configuration"

### Fixed

- Admins no longer hit an error when accessing a non-existent index
- Clearer error messages across admin flows
- `LogContextView` no longer retains unused state

### Removed

- Unit and integration test suite removed — the project no longer maintains tests
- Accent colour from checkboxes

### Upgrade notes

1. Back up `sqlite.db` before running migrations.
2. Run `bun run db:migrate` — migrations `0025`–`0030` will apply.
3. Recreate any ingest tokens through **Administration → Tokens** and update your log shippers.
4. If you override the HTTP port, confirm your compose/proxy configuration still works with the new `8282` default.
5. Point OpenTelemetry exporters at `/api/otlp/v1/logs` if you want OTLP ingestion.

## [0.1.11] and earlier

See the [git history](https://github.com/rootprint/rootprint/commits/main) for releases prior to 0.2.0.

[0.3.0]: https://github.com/rootprint/rootprint/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/rootprint/rootprint/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rootprint/rootprint/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rootprint/rootprint/compare/v0.1.11...v0.2.0
