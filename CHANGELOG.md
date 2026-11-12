# Changelog

All notable changes to Rootprint are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A release's optional `### Highlights` bullets (plain text, written for users) are announced once in the app's sidebar and stay under **Help → What's new**.

## [Unreleased]

## [0.4.7] - 2026-11-12

### Highlights

- **Auto-refresh.** In Logs, the arrow beside **Run** reruns the search every 5 to 60 seconds.
- **Log context scopes.** A log's **Context** tab narrows the surrounding lines to its service, pod, node, container or host, or to the fields you pick.
- **OpenTelemetry logs template.** A new index can start from the mapping that OTLP log ingest needs.
- **OpenID Connect from environment variables.** Keep the provider in your deployment config instead of **Settings → Authentication**.

### ⚠️ Breaking

- **The per-user, per-key and per-index activity endpoints are gone.** `GET /api/admin/activity/users/{userId}/…`, `/api-keys/{apiKeyId}/…` and `/indexes/{indexId}/…` return `404`. Pass `user`, `apiKey` or `index` as query parameters to `GET /api/admin/activity/summary`, `/latency` and `/top-actors`, and to the new `/recent` and `/indexes`. The `/volume` endpoints have no replacement: each `/latency` bucket carries its search `count`. ([#182](https://github.com/rootprint/rootprint/pull/182))
- **`GET /api/indexes/{indexId}/logs` returns `numHits: null` without `countAll=true`**, instead of a number that could be lower than the real count. ([#197](https://github.com/rootprint/rootprint/pull/197))
- **`GET /api/indexes/{indexId}/logs/histogram` requires `startTs` and `endTs`.** `interval` takes seconds, minutes, hours or days, not weeks, months or years, and the range divided by the interval can give at most 2,000 buckets. Anything else returns `400`. ([#190](https://github.com/rootprint/rootprint/pull/190))
- **`GET /api/indexes/{indexId}/fields/values` accepts at most 50 filters** and no longer returns `elapsedTimeMicros`. The fields in one request share 65,000 values, so each field gets `limit` or its share of that, whichever is lower; `truncated` says which fields were cut short. ([#190](https://github.com/rootprint/rootprint/pull/190))
- **The per-index Context fields setting is removed.** `GET /api/indexes/{indexId}` and `GET /api/indexes/{indexId}/config` no longer return `contextFields`, `PATCH /api/indexes/{indexId}` ignores it, and upgrading drops the saved values. The Context tab's scopes replace it. ([#196](https://github.com/rootprint/rootprint/pull/196))

### Added

- **Auto-refresh in Logs.** The arrow beside **Run** sets an interval of 5, 10, 15, 30 or 60 seconds. It runs on relative time ranges, sorts newest first, and pauses while you are scrolled down, the tab is in the background, or a fold or a log is open. A failed refresh keeps the rows and chart on screen and retries. ([#193](https://github.com/rootprint/rootprint/pull/193))
- **Context scopes.** A log's **Context** tab offers **All**, **Service**, **Instance**, **Pod**, **Node**, **Container** and **Host**, each shown when the log has the fields for it, and **Custom**, which matches any of the log's fields you tick. **Open in search** carries the scope into Logs. ([#196](https://github.com/rootprint/rootprint/pull/196))
- **Back button in the log drawer.** Clicking a line in **Context** opens that log, and **Back** returns to the previous one. ([#196](https://github.com/rootprint/rootprint/pull/196))
- **OpenTelemetry logs template** under **Start from** when creating an index. ([#199](https://github.com/rootprint/rootprint/pull/199))
- **`bytes` field type** in index mappings, with base64 or hex input and output formats, and a **default search path** for JSON fields. ([#199](https://github.com/rootprint/rootprint/pull/199))
- **`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`** configure OpenID Connect from the environment. Set all three or none. They replace the provider saved in **Settings → Authentication**, which then shows it read-only, and `PUT` and `DELETE /api/settings/auth/oidc/credentials` return `409` with code `OIDC_MANAGED_BY_ENV`. Moving a provider from the UI to the variables unlinks every OpenID Connect account once. See [Configure with environment variables](https://docs.rootprint.io/configuration/oidc-auth#configure-with-environment-variables). ([#186](https://github.com/rootprint/rootprint/pull/186))
- **`GET /api/admin/activity/recent` and `GET /api/admin/activity/indexes`** list recent searches and per-index usage, filtered by `user`, `apiKey` and `index`. Summary rows gain `displayName`. ([#182](https://github.com/rootprint/rootprint/pull/182))
- **Search volume chart** on **Settings → Activity**, beside latency. ([#182](https://github.com/rootprint/rootprint/pull/182))
- **`GET /api/indexes/{indexId}/fields` reports `indexed` per field**, and `GET /api/indexes/{indexId}/config` lists `unfilterableFields`. ([#196](https://github.com/rootprint/rootprint/pull/196))

### Changed

- **The API finishes in-flight requests before it exits** on `SIGTERM` or `SIGINT`. ([#192](https://github.com/rootprint/rootprint/pull/192))
- **`GET /api/indexes/{indexId}/logs` returns `400` when `startTs` is not before `endTs`**, as the trace and service endpoints do. ([#194](https://github.com/rootprint/rootprint/pull/194))
- **Settings → Overview reports a failed metrics refresh at once**, with the error and a retry, instead of after several failures. ([#179](https://github.com/rootprint/rootprint/pull/179))
- **Service pages drop the heading that repeated each tab's name**, and the Overview tab says what its charts measure. ([#202](https://github.com/rootprint/rootprint/pull/202))
- The Docker image runs on Bun 1.4.4. ([#188](https://github.com/rootprint/rootprint/pull/188))

### Removed

- **The span count above the trace explorer's span list.** ([#201](https://github.com/rootprint/rootprint/pull/201))

### Fixed

- **The field panel shows cut-off values for large fields** instead of failing with a `503` once its open fields together pass 65,000 values. ([#190](https://github.com/rootprint/rootprint/pull/190))
- **Include and exclude are offered only on fields a filter can match.** The log drawer hides them on unindexed fields and on values Quickwit cannot match. ([#196](https://github.com/rootprint/rootprint/pull/196))
- **Filters work on field names that contain spaces, parentheses or quotes.** ([#196](https://github.com/rootprint/rootprint/pull/196))
- **A service's failing spans and the trace explorer's span list ignore answers to requests they cancelled.** Rows stay on screen while new ones load, and a failed first page can be retried. ([#195](https://github.com/rootprint/rootprint/pull/195))
- **Sign-in provider forms keep text typed into a list field.** It is added when you leave the field, and the form does not save while text that could not be added remains. ([#196](https://github.com/rootprint/rootprint/pull/196))

## [0.4.6] - 2026-10-20

### Highlights

- **Connect an AI agent.** Claude Code, Cursor and other MCP clients can search your logs and spans and read traces with your personal API key.
- **Index overview.** Each index in **Settings → Indexes** opens on its size, ingest volume, ingest keys and search activity.
- **Local or UTC time.** Turn on **Time in UTC** in the user menu to show timestamps, time ranges and charts in UTC.
- **Services and the trace explorer** search time ranges longer than 30 days.

### ⚠️ Breaking

- **`GET /api/indexes/{indexId}/logs` counts every match only with `countAll=true`.** Without it, `numHits` can be lower than the real number of matches, and **Settings → Activity** shows no hit count for the search. ([#164](https://github.com/rootprint/rootprint/pull/164))
- **`GET /api/traces/explore/spans` returns `total: null` when `offset` is above `0`.** The first page carries the count. ([#164](https://github.com/rootprint/rootprint/pull/164))
- **API logs use OpenTelemetry attribute names.** The API writes one line per request, with `http.request.method`, `http.route`, `url.path`, `http.response.status_code`, `duration_ms`, `client.address`, `user.id`, `rootprint.api_key.id` and `rootprint.index.id`, at `warn` for 4xx responses and `error` for faults. `level` is a name such as `"info"` instead of a number, `time` is ISO 8601, `service` is now `service.name` beside `service.version`, and `requestId` is `http.request.id` on every line written during a request. Update log parsers and alerts that match the old fields. ([#169](https://github.com/rootprint/rootprint/pull/169))

### Added

- **MCP server at `/api/mcp`.** Seven read-only tools list indexes and fields, search logs and spans, count logs over time, list top field values and read whole traces. It accepts a personal or service account API key as a bearer token, never a session cookie, and shares the key owner's read rate limit. Set it up with [Connect an AI agent](https://docs.rootprint.io/api/mcp). ([#160](https://github.com/rootprint/rootprint/pull/160))
- **Overview tab on an index's settings page.** It opens first and shows the document count, size, compression ratio, splits and last event; events over the last 24 hours; index size over time; the ingest keys that write to the index; and its search activity, latency and top users and API keys. Drag across the events chart to open that range in Logs. See [Overview tab](https://docs.rootprint.io/configuration/manage-indexes#overview-tab). ([#163](https://github.com/rootprint/rootprint/pull/163))
- **Open in Logs**, or **Open in Traces** for the span store, on an index's settings page. ([#163](https://github.com/rootprint/rootprint/pull/163))
- **`GET /api/indexes/{indexId}/describe`** returns an index's live document count, sizes, split count and newest event time. **`GET /api/admin/activity/indexes/{indexId}/summary`, `/latency` and `/actors`** report one index's search activity. ([#163](https://github.com/rootprint/rootprint/pull/163))
- **Local or UTC time.** **Time in UTC** in the user menu switches timestamps, time-range labels and inputs, and chart axes to UTC. Your browser remembers the choice. ([#175](https://github.com/rootprint/rootprint/pull/175))

### Changed

- **Services, service pages and the trace explorer accept time ranges longer than 30 days**, as do `GET /api/services`, `GET /api/services/errors`, the trace explorer endpoints and the MCP `search_spans` tool. ([#175](https://github.com/rootprint/rootprint/pull/175))
- **A time range gets the same bucket width on all charts**, from 1 second to 7 days. Short ranges label seconds on the axis. ([#175](https://github.com/rootprint/rootprint/pull/175))
- **Leaving a page stops its searches.** Services, service pages and the trace explorer cancel their searches when you navigate away or change filters, and the API stops a Quickwit search when its client disconnects. The client gets an empty `499` response. The search audit records the search as `cancelled`, and **Settings → Activity** leaves it out of its counts and charts. ([#173](https://github.com/rootprint/rootprint/pull/173))
- **Submitting the current log search again reruns it.** ([#176](https://github.com/rootprint/rootprint/pull/176))
- **The API startup log reports the Quickwit version**, and ingest request logs report how many records Quickwit accepted and rejected. ([#169](https://github.com/rootprint/rootprint/pull/169))
- Updated dependencies, including SvelteKit 3.1, Better Auth 1.7.10, Hono 4.13.13, Svelte 5.57.2, Vite 8.3.4, daisyUI 5.7.50 and dotenv 18. `source-map-js` 1.2.2 fixes GHSA-68fv-2mgg-jv7q. ([#154](https://github.com/rootprint/rootprint/pull/154), [#159](https://github.com/rootprint/rootprint/pull/159), [#162](https://github.com/rootprint/rootprint/pull/162), [#174](https://github.com/rootprint/rootprint/pull/174))

### Removed

- **Arrow-key navigation** between tabs on service and trace pages, and between options in the service picker. Enter in the service picker picks the first match. ([#172](https://github.com/rootprint/rootprint/pull/172))
- **The `/settings/activity/users/<id>` redirect.** Use `/settings/users/<id>`. ([#156](https://github.com/rootprint/rootprint/pull/156))

### Fixed

- **A failed log search clears the previous results.** A failed **Load more** keeps the rows already loaded. ([#176](https://github.com/rootprint/rootprint/pull/176))
- **Creating an API key refreshes the key list.** ([#156](https://github.com/rootprint/rootprint/pull/156))
- **JSON and code blocks show as plain text while highlighting loads**, or if it fails. Revealing an API key shows a loading state, and a failed fetch shows an error and closes the dialog. ([#155](https://github.com/rootprint/rootprint/pull/155))

## [0.4.5] - 2026-10-01

### Highlights

- **Trace explorer.** Chart span volume, error rate and latency, find the busiest operations, and filter spans by service, operation, duration and status.
- **Service pages.** Every service has its own page with Overview, Operations, Dependencies and Errors tabs, each linking to the matching traces.
- **Trace pages** gain span search and a Database tab that groups a trace's database calls by query.
- **Paste a trace ID** into the Logs search to open the trace.
- **Send data guides** start with your ingest key and end in Logs or the trace explorer.

### ⚠️ Breaking

- **The Services API moved from `/api/monitoring` to `/api/services`.** `GET /api/monitoring/services` is now `GET /api/services`, and `GET /api/monitoring/errors` is now `GET /api/services/errors`. The old paths return `404`. The OpenAPI schema names drop the `Monitoring` prefix (`MonitoringSummary` is now `ServiceHealthSummary`), and the endpoints move from the `Monitoring` tag to `Services`. ([#146](https://github.com/rootprint/rootprint/pull/146))
- **`GET /api/services` returns `endpoints: []` without `service`,** and ignores `endpointLimit`. Pass `service` for a service's operations. ([#145](https://github.com/rootprint/rootprint/pull/145))

### Added

- **Trace explorer** at `/traces`. Span, error-rate and p50/p95/p99 latency charts, the 200 busiest operations, and a span list sortable by start time or duration. Filters: service, operation, minimum and maximum duration, status, root spans only, and a Quickwit query.([#119](https://github.com/rootprint/rootprint/pull/119), [#150](https://github.com/rootprint/rootprint/pull/150))
- **Service pages** at `/services/<name>`, with Overview, Operations, Dependencies and Errors tabs. Operations show their error rate. Operations, dependencies and errors open the matching spans in the trace explorer. ([#126](https://github.com/rootprint/rootprint/pull/126), [#138](https://github.com/rootprint/rootprint/pull/138))
- **Span search on trace pages** by service, name, span ID or attribute, with a match count ([#120](https://github.com/rootprint/rootprint/pull/120))
- **Database tab on trace pages.** A trace's database calls, grouped by target and statement, with call counts, durations and failures. ([#121](https://github.com/rootprint/rootprint/pull/121))
- **Trace IDs open their trace.** A 32-character hex ID typed into the Logs or trace explorer search opens the trace when it has spans, and is searched as text otherwise. ([#126](https://github.com/rootprint/rootprint/pull/126), [#127](https://github.com/rootprint/rootprint/pull/127))
- **What's new.** A release's highlights appear once in the sidebar and stay under **Help → What's new**. ([#135](https://github.com/rootprint/rootprint/pull/135))
- **GitHub** link in the sidebar, below Help, with the repository's star count. ([#134](https://github.com/rootprint/rootprint/pull/134))
- **`GET /api/services` endpoint rows gain `errors`, `operation` and `query`**, and `endpointLimit=0` skips the endpoint searches. ([#126](https://github.com/rootprint/rootprint/pull/126), [#138](https://github.com/rootprint/rootprint/pull/138))
- **`GET /api/traces/{traceId}` reports the instrumentation scope** as the `otel.scope.name` and `otel.scope.version` span attributes. ([#120](https://github.com/rootprint/rootprint/pull/120))

### Changed

- **Search is now Logs, at `/logs`; Services moved to `/services`.** `/` and `/monitoring` redirect and keep their query string, so bookmarked searches still open. Links to `/services?service=<name>` redirect to the service's page. ([#133](https://github.com/rootprint/rootprint/pull/133), [#138](https://github.com/rootprint/rootprint/pull/138))
- **Profile moved to the user menu**, at `/profile`. ([#133](https://github.com/rootprint/rootprint/pull/133))
- **Send data** (formerly **Settings → Send logs & traces**) is a sidebar entry for admins, below Services, at `/send-data`. ([#133](https://github.com/rootprint/rootprint/pull/133), [#136](https://github.com/rootprint/rootprint/pull/136))
- **Settings is admin-only.** Members no longer see it in the sidebar. ([#137](https://github.com/rootprint/rootprint/pull/137))
- **Send data guides start with the ingest key.** You pick or create the key in step 1, and the snippets use it. The last step opens Logs or the trace explorer, and the catalog groups the nine integrations by kind. ([#137](https://github.com/rootprint/rootprint/pull/137))
- **Services counts consumer and root spans as requests**, not only server spans, so queue workers and scheduled jobs appear. `GET /api/services` numbers change accordingly. ([#138](https://github.com/rootprint/rootprint/pull/138))
- **The Services catalog is a sortable table**, worst error rate first, below the summary and charts. ([#138](https://github.com/rootprint/rootprint/pull/138))
- **Latency percentiles read half a millisecond higher.** Quickwit stores span durations in whole milliseconds, so `p50`, `p95` and `avg` in `GET /api/services` now report the midpoint of that millisecond. A sub-millisecond operation shows `<1 ms` instead of `0 ms`. ([#130](https://github.com/rootprint/rootprint/pull/130))
- **Text exports contain only timestamp, level and message**, as `<ISO 8601 time> [<level>] <message>`. Other fields are no longer appended; export JSON or CSV for those. Epoch timestamps in seconds through nanoseconds are converted, and nested timestamp, level and message fields are read. ([#149](https://github.com/rootprint/rootprint/pull/149))
- **Large traces show their earliest spans.** A trace with more than 2,000 spans keeps the first 2,000 by start time. Trace pages show the root service and start time. ([#120](https://github.com/rootprint/rootprint/pull/120))
- **Durations, counts, rates and timestamps use one format on every page.** Short spans show microseconds, operation rates are per minute, timestamps are numeric with milliseconds, and charts spanning several days label the date. ([#130](https://github.com/rootprint/rootprint/pull/130), [#131](https://github.com/rootprint/rootprint/pull/131))
- **Index and source settings forms show errors inline** and scroll them into view. ([#140](https://github.com/rootprint/rootprint/pull/140))
- **The Quickwit client is now `@rootprint-io/quickwit-js` 0.5**, the renamed `quickwit-js`. Every search now goes to Quickwit as a POST. ([#141](https://github.com/rootprint/rootprint/pull/141))
- **Quickwit 0.9.1** in `docker-compose.yml`, a security patch release. If you run your own Quickwit, upgrade it to 0.9.1.
- Updated dependencies, including Better Auth 1.7.6, Hono 4.13.9, Svelte 5.57.1, Vite 8.3.1 and daisyUI 5.7.46. ([#143](https://github.com/rootprint/rootprint/pull/143))

### Removed

- **Cross-service Endpoints and Errors tabs** on Services. Use the trace explorer's Operations tab, or a service's Errors tab. ([#138](https://github.com/rootprint/rootprint/pull/138))
- **Integration search** on the Send data page. ([#137](https://github.com/rootprint/rootprint/pull/137))

### Fixed

- **`503` responses keep their message and send `Retry-After: 5`.** An unreachable Quickwit `/metrics` endpoint returned `Internal server error` with no retry hint, and its message no longer includes Quickwit's URL. ([#132](https://github.com/rootprint/rootprint/pull/132))
- **`GET /api/services/errors` returns an empty list when the span store is missing**, as the other trace endpoints do, instead of `404`. ([#146](https://github.com/rootprint/rootprint/pull/146))
- **`durationMillis` in `GET /api/services/errors` is no longer `0` for sub-millisecond spans.** It comes from the span's timestamps.
- **Log API calls with a fractional `endTs` no longer drop the last partial second.** The log search, histogram, field, field-values and export endpoints round `endTs` up to the next whole second instead of truncating it. The web app always sends whole seconds and was not affected. ([#142](https://github.com/rootprint/rootprint/pull/142))
- **The log histogram adds up levels that differ only in case**, such as `info` and `INFO`, instead of showing one of them. ([#129](https://github.com/rootprint/rootprint/pull/129))
- **Send data guides deliver data as written.** Logs arrive with a service name and keep their own severity, and the snippets use current component names and APIs. The guides offer only ingest keys on `otel-` indexes: Quickwit answers 200 to OTLP logs sent to any other index and discards them. ([#137](https://github.com/rootprint/rootprint/pull/137))

## [0.4.4] - 2026-09-22

### ⚠️ Breaking

- **Better Auth's admin endpoints under `/api/auth/admin/*` are closed.** Use `/api/users` for user management and `/api/service-accounts` for service accounts.
- **`hasCredentialAccount` removed from `GET /api/users` rows.** Users can keep a password alongside linked providers; the user page no longer shows the "Auth" chip.
- **Migration `0022` drops the legacy `user.banned`, `user.ban_reason` and `user.ban_expires` columns.** Rolling back to 0.4.3 after migration requires restoring those columns or a database backup.

### Added

- **OpenID Connect SSO.** One provider, configured by issuer URL, client ID and client secret under **Settings → Authentication → OpenID Connect**, or via `GET /api/settings/auth/oidc`, `PUT`/`DELETE /api/settings/auth/oidc/credentials`. Discovery is fetched at save time and refused when the issuer, endpoints or PKCE `S256` support are missing; ID token signatures are verified against the issuer's JWKS. New users are created with the `user` role and same-email accounts are linked. `GET /api/auth/providers` gains `oidc.enabled`.
- **Password sign-in toggle.** `PUT /api/settings/auth/password` with `{ "enabled": false }` disables `/api/auth/sign-in/email`; invitations and admin password resets keep working. `GET /api/auth/providers` gains `password.enabled`.
- **Log explorer fold mode** (`fold=1`): consecutive rows that match on every visible column except timestamp collapse behind a count badge.
- **Syslog severity aliases** `emerg`, `alert`, `crit`, `err` and `notice` have matching colors and severity ordering.
- **`INGEST_PROXY_TIMEOUT_MS`** sets how long `/ingest`, `/v1/logs` and `/v1/traces` wait on Quickwit before answering `503`. Default 120 seconds.

### Changed

- **Provider access checks run at sign-in.** Google domain and GitHub organization allow-lists apply when users create, link or sign in to an account. Removing a provider revokes its users' sessions; allow-list edits apply at the next sign-in.
- **Invited users can onboard through Google, GitHub or OpenID Connect** without first setting a password. Linking a provider consumes the invite and leaves any existing password in place.
- **Changing the OpenID Connect issuer URL or client ID unlinks every OpenID Connect account** and signs those users out; they re-link by email on their next sign-in, or an admin resets their password.
- **Admins can reset the password of, or reissue an invite to, any user,** including users who first signed in through a provider.
- **OAuth access and refresh tokens are stored encrypted** with `BETTER_AUTH_SECRET`. Set it explicitly if that protection should survive a database compromise; the generated secret lives in the same database.
- **Sign-in page** shows an error when the providers request fails instead of assuming password sign-in.
- **Authentication and admin settings UI** gains clearer sign-in states, keyboard-accessible table rows and responsive user, API-key and service-account tables.
- **Session validation reads the database on each request,** so role changes and revocations apply on the next request.
- **OIDC discovery retries after an unreachable issuer at boot,** with a default interval of 60 seconds configurable through `OIDC_RETRY_MS`.
- **Internal:** centralized auth field definitions and shared row-limit controls across monitoring tables.

### Fixed

- A first administrator created with a mixed-case email could not sign in.
- A rejected Google or GitHub first sign-in left a user row with no account.
- First-admin setup now reloads authentication configuration before the next sign-in.
- Auth requests with an explicit `Origin: null` no longer bypass origin validation through a server-side origin replacement.
- Re-running an unchanged query refreshes log results, histogram counts, field discovery and field values.
- Log context pagination advances through dense time windows and shows pagination limits.
- Default display columns remain defaults when changing line wrap or display mode, including while preferences load.
- Expanded fields and collapsed field groups persist on user toggles without overwriting another index's preferences during navigation.
- An ingest request that timed out or lost the connection while reading Quickwit's response returned `500` instead of the retryable `503`.

## [0.4.3] - 2026-09-10

### ⚠️ Breaking

- `GET /api/indexes/{indexId}/fields` now requires `startTs` and `endTs` in epoch seconds.

### Added

- Range-scoped discovery of dynamic and nested JSON fields, with static-schema fallback.
- Field pinning, collapsible OpenTelemetry attribute groups, and virtualized field lists.
- Autocomplete loading and empty states, prefix-match priority, and a 50-suggestion limit with an overflow count.

### Changed

- Log drawer search moved to the properties pane, filtering by name or value.
- Updated typography, colors, spacing, and responsive layouts.
- GitHub releases include the matching changelog section.
- Updated dependencies, including Bun 1.4.2 and Better Auth 1.7.3. Migration `0021` adds nullable `session.impersonated_by`.
- Internal: migrated DOM behaviors to Svelte attachments and refactored OAuth forms and route error handling.

### Fixed

- Field discovery retries and value refresh after discovery errors.
- Duplicate field-value counts and boolean filter values.
- Duplicate row-key errors in log drawer properties.
- Chart resizing after initialization.

## [0.4.2] - 2026-09-03

### ⚠️ Breaking

- **`GET /api/indexes/{indexId}/stats` range parameters.** `from`/`to` in milliseconds are now `startTs`/`endTs` in epoch seconds.
- **`services` in `GET /api/monitoring/services` is now a list of objects** — `{ name, requests, errors, p50, p95 }`. The plain name list lives on as `serviceNames`, and `summary` gains `errorSpans`.
- **Security headers on every response**, from Hono's `secureHeaders()`: `X-Frame-Options: SAMEORIGIN`, COOP and CORP `same-origin`, `Referrer-Policy: no-referrer` and `nosniff`. Embedding the UI cross-origin stops working.

### Added

- **`GET /api/monitoring/errors`** — the failing spans behind the error rate, newest first. Filters: `service`, `operation`, `kind` (`server`, `client`, `producer`, `consumer`, `internal`), `httpStatus` (`4xx`, `5xx`, `none`), `startTs`/`endTs`, `limit` (max 100) and `offset` (max 5000). Rows carry `traceId`, `spanId`, `timestampMs`, `service`, `operation`, `kind`, `message`, `httpStatus` and `durationMillis`, alongside `hasMore`. Needs `logs:read` (session cookie, personal key or service-account key) and is recorded in the search audit.
- **APM detail on `/monitoring`** — tabs for services, endpoints, dependencies and errors. Services rank by request volume with failure share and p50/p95; dependencies list each service's outbound peers with call count, total time and p50/p95; errors is a filterable span list, each row linking to its trace.
- **`failingOperations` and `dependencies` on `GET /api/monitoring/services`** — operations ranked by error count, and per-service outbound call volume and latency.
- **Monitoring state lives in the URL** — the active tab (`view`), the scoped service, and the error filters (`operation`, `kind`, `httpStatus`), so a filtered view can be linked or bookmarked.
- **Pagination on the service and endpoint tables**, with the rows-per-page choice remembered.

### Changed

- **Request IDs come from Hono's own middleware.** An inbound `x-request-id` that isn't a short, plain token is replaced with a fresh UUID instead of being echoed into the request's log lines and error body.
- **Native scrollbars everywhere.** The `overlayscrollbars` and `overlayscrollbars-svelte` dependencies are gone.
- **Bun 1.4.0** in the image, in `engines` and in `bun-types`; CI now runs `bun audit --audit-level=high`.
- **Log search and monitoring-error empty states** say what happened, announce themselves to screen readers, and offer "Clear filters" when filters explain the empty result.
- **Internal:** request logs carry the matched `route` next to `path`, database initialization moved to `lib/db`, timestamp query parameters share one validator carrying their unit, and unused Quickwit index metadata fields were dropped.

### Fixed

- Tooltips on the collapsed sidebar — nav items, **Help**, and the collapse toggle — never appeared.
- A JSON error response that isn't a Rootprint payload (a proxy 502, say) surfaced a `TypeError` instead of the real failure.

## [0.4.1] - 2026-08-26

### ⚠️ Breaking

- **Saved view `description` removed** from the create/patch bodies and responses of `/api/indexes/{indexId}/views`. Migration `0019` drops the column, deleting the text; 0.4.0 still selects it, so rolling back breaks every saved-view read. Read it out first if you need it: `SELECT id, index_id, name, description FROM "view" WHERE description IS NOT NULL;`

### Added

- **Service health dashboard** at `/monitoring`: request rate, error rate, latency, per-service p95, and endpoints ranked by total time.
- **`GET /api/monitoring/services`** — `startTs`, `endTs`, `interval`, optional `service` and `endpointLimit`; max 30-day range and 2000 buckets. Needs `logs:read` (session cookie or personal key) and is recorded in the search audit.
- **`timeRange` on saved views** — a relative preset (`5m`–`30d`) or an absolute epoch-second window, opt-in when saving. Views saved without one leave the current range alone.
- **`SEARCH_AUDIT_RETENTION_DAYS`** prunes search audit rows on the hourly stats tick. Default and minimum 30 days; lower values fail at boot.
- **`omittedCount` on histogram buckets** — how many documents the bucket's returned level terms left out. The web derives an `UNKNOWN` level from it for documents with no level field; being synthetic, it cannot be filtered on.

### Changed

- **GitHub org membership** is read from one paginated `GET /user/memberships/orgs` (≤10 pages of 100) and matched case-insensitively, instead of one probe per configured org. 5s timeout, redirects refused, failures logged with GitHub's rate-limit headers. Failure still denies access; an error raised during the check now denies the sign-in instead of failing the request.
- **Durations over a minute** format as minutes, hours, or days.
- **README** leads with the live demo at [demo.rootprint.io](https://demo.rootprint.io).
- **Internal (web):** the root layout no longer re-fetches session and bootstrap state on client-side navigation, endpoint row-count buttons filter locally, modal busy state and the field row and time-range picker were centralized, and the Geist fonts are preloaded.

### Fixed

- Switching indexes clears the views dropdown instead of leaving the previous index's views on screen.
- Saving a view no longer stores an empty column set before display preferences resolve.
- The log detail drawer dropped `aria-modal`; it never trapped focus or blocked the page.
- Page titles and breadcrumbs for the index edit and GitHub authentication pages.
- A field table's last row no longer draws a border against the container's own.

## [0.4.0] - 2026-08-12

### ⚠️ Breaking

- **Per-index visibility is gone.** Any index previously set to `admin` or `hidden` becomes readable by every signed-in user and every `logs:read` personal API key once the migration runs. The `visibility` field is gone from `PATCH /api/indexes/:indexId`, the `?view=` query parameter is gone from `GET /api/indexes`, and `visibility` is gone from every per-index row in `GET /api/admin/cluster`.

  **Action required before upgrading.** Migration `0017` drops the column, so once it has run there is no record of which indexes were restricted. Inventory them first:

  ```sql
  SELECT index_id, visibility FROM index_settings WHERE visibility <> 'all';
  ```

  The migration is forward-only and runs automatically at boot. Rolling the image back to 0.3.6 afterwards leaves that version selecting a column that no longer exists, which fails every index read — recovery needs a database restore.

- **`GET /api/indexes` returns a smaller row.** `fieldCount`, `sourceCount`, `mode`, and `createTimestamp` are no longer included. `mode` moved to `GET /api/indexes/:indexId`, where `fieldCount` and `sourceCount` can be derived from `fields` and `sources`; note that endpoint is admin-only and cookie-authenticated, so it is not a substitute for callers using a personal API key. `createTimestamp` is removed with no replacement.

- **`role` is gone from ingest keys.** The field no longer appears on the rows returned by `GET /api/api-keys`. It had been pinned to the single value `"ingest"` ever since 0.3.5 removed the search role, so nothing could branch on it; migration `0018` drops the column along with its index and check constraint. Like `0017` it is forward-only, and 0.3.6 selects the column it removes — rolling back after it runs breaks every API-key read.

- **Quickwit metrics fields renamed and dropped in `GET /api/admin/metrics`.** `uptimeSeconds` is gone from the top level, `fdsOpen` and `fdsMax` are gone from `resources`, and `memoryRssBytes` is now `memoryResidentBytes`. Quickwit 0.9 stopped exporting the metrics behind the removed fields, so they had already been reporting `null`; they were marked deprecated before being dropped. The `build` block (`version`, `commitHash`, `buildDate`) is now read from the same metrics scrape rather than a separate version probe.

### Added

- **Traces.** Ingest OTLP spans with `POST /v1/traces` using any existing ingest key, and open a trace from the log that belongs to it — the log detail drawer gains a **Trace** tab with an inline waterfall, and a full trace page at `/traces/:traceId` shows the waterfall with per-span attributes, events, and links back to correlated logs. Pasting a trace ID into the log search box opens that trace directly. Spans are stored in one configured index (`TRACE_INDEX_ID`, defaulting to `otel-traces-v0_9`).

  Trace detail is a raw `trace_id` search with no time bound, so a trace stays openable for as long as its spans are retained — Quickwit's Jaeger API, which this does not use, ignored the requested window and looked back a fixed 72 hours. The response carries `truncated`, and the view says so when a trace is larger than one request returns. Duplicate span documents that OTLP retries produce are collapsed by `span_id`. In the attributes panel `otel.status_code` and `error` are dropped as restatements of the span's own error state, while `span.kind` and `otel.status_description` are kept.

  There is no span search or trace list in this release: traces are reached from a log or by trace ID.

- **Per-index "Trace ID field" setting.** `traceIdField` on `PATCH /api/indexes/:indexId` and in the index config form names the path to a trace ID inside a log document. It is what links logs to traces in both directions, and it defaults to `trace_id`.

- **Trace setup in the send-telemetry wizard.** **Settings → Send logs** is now **Settings → Send logs & traces**, and its route moved from `/settings/send-logs` to `/settings/send-telemetry`. Each integration has a traces variant (`?signal=traces`) alongside its logs snippets. Keys anchored to the span store are hidden from the wizard's key picker, since they cannot ship logs.

- **Cluster identity and node counts in admin health.** The `health` block of `GET /api/admin/cluster` adds `clusterId`, `readyNodes`, `liveNodes`, and `deadNodes`, each nullable when the upstream does not report it.

- **`isTraceIndex` on index rows.** Both `GET /api/indexes` and `GET /api/indexes/:indexId` flag the index that holds spans, so clients can tell it apart without knowing the value of `TRACE_INDEX_ID`.

- **`information` recognized as a severity level.** It sorts next to `info` in the level facet and gets its own color, alongside the existing `warning`/`critical` aliases.

- **Sourcemaps in production API builds,** so stack traces from the bundled `dist/app.js` map back to source.

### Changed

- **Ingest keys can no longer be created against the span store.** `POST /api/api-keys` returns `400 INDEX_IS_TRACE_INDEX` for an index equal to `TRACE_INDEX_ID`, since a key anchored there would write log documents into the span index. An existing key anchored there keeps working for `POST /v1/traces`, but its log ingestion (`POST /v1/logs`, `POST /api/ingest`) is now rejected with the same error.
- **`POST /v1/logs` now reports partial failures.** It forwards Quickwit's `partial_success.rejected_log_records` instead of always returning an empty success body, and upstream 4xx statuses pass through rather than collapsing to `400`. OTLP exporters that were receiving silent successes will start seeing rejections they were previously blind to.
- **Filter values containing `<`, `>` or `=` are now quoted when composed into a query.** Saved views and shares whose filter values contain those characters produce a slightly different Quickwit query than before; results should be the same or more accurate, since previously those characters were passed through as query operators.
- **New ingest keys carry an `rp_` prefix** instead of `lwit_`. The prefix is only applied when a key is minted and is not part of how a key is looked up, so keys issued by earlier versions keep working unchanged.
- **Unmatched `/api/*` paths return a JSON 404** instead of falling through to the SPA's HTML shell. A typo in a client's path now surfaces as a parseable error rather than a page of markup.
- **The empty-state onboarding screen is driven by a live document check.** `GET /api/admin/cluster/document-status` asks Quickwit directly instead of reading the periodic snapshot, so a fresh cluster leaves the getting-started screen as soon as the first document lands rather than at the next snapshot. The span store is excluded from the check — spans alone do not count as having logs.
- **Menus and dropdowns use the browser's native popover API,** which replaces the hand-rolled open/close and outside-click handling.
- **New logo mark** across the app and its favicon.
- **Internal (api):** the index middlewares were consolidated into one implementation, log-scope and API-key parameter schemas were centralized, request logs now record the final response status, API-key `lastUsedAt` writes are throttled in SQL, and export batching and search totals were separated from result queries.
- **Internal (web):** shared search and time-range controls, modal form handling, and form/confirmation error handling were centralized; the charts share one `UplotChart` component; and hand-written response casts gave way to the Hono RPC client's inferred types.
- **Dependency updates,** including quickwit-js 0.4, Vite 8, `@sveltejs/vite-plugin-svelte` 7, Hono, and Better Auth 1.6.25.

### Fixed

- **Log list and search toolbar interaction edge cases,** including stale field keys in the field-mappings editor, a modal that ignored cancellation, and JSON pane rendering in the log drawer.
- **Popovers no longer stay visible when closed** in cases where a display utility class fought the native `[popover]` state.

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
