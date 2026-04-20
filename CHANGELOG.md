# Changelog

All notable changes to Logwiz are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

See the [git history](https://github.com/oleksandr-zhyhalo/logwiz/commits/main) for releases prior to 0.2.0.

[0.2.1]: https://github.com/oleksandr-zhyhalo/logwiz/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/oleksandr-zhyhalo/logwiz/compare/v0.1.11...v0.2.0
