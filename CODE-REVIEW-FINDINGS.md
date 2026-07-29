# Code review findings — feat/traces

Effort: xhigh · 16 findings · diff vs `main` (54 changed files)

## Summary

The 49 verified findings collapse to 18 distinct defects, of which the 16 most severe are kept. The highest-impact deployment defect replaces committed migrations `0017` and `0018`; a database that applied the originals can rerun the replacements and fail during startup. The dominant runtime root cause is that the new trace pairing has two sources of truth — persisted `index_settings` rows versus the synthesized `defaultSettings()` pairing — and every consumer picks a different one: `verifyApiKey` (raw left join), `saveIndexConfig` (writes unmerged fields), `assertPairingVisibility` and `deleteIndex` (row-scoped queries) each disagree with the read path, producing broken span ingest on a default install, silent unpairing on a partial PATCH, and a bypassable same-visibility invariant. Two independent security issues also survived: a trace index is still directly searchable via `/api/indexes/:id/logs` regardless of the paired log index's visibility, and the new `returnTo` sink inherits `safeReturnTo`'s backslash gap, making "Back to logs" an open redirect. Remaining items are missing server-side validation of `traceIndexId`, a client/server mismatch in the ingest-destination filter, and small cleanups (dead migration guard, dead null-check, over-broad deploy rsync).

## Findings

Ranked most-severe first.

### 1. apps/api/drizzle/meta/_journal.json:125

**CONFIRMED** · correctness

The change deletes committed migrations `0017_first_wendell_vaughn` and `0018_backfill_trace_pairing`, then replaces them with new entries that have later timestamps, different tags, and different SQL. Drizzle can treat the replacements as pending after a database has already applied the originals.

**Failure scenario:** A deployment applied the committed `0017` and `0018` from `feat/traces`, so its migration table records the original timestamps. It then deploys this working tree. Drizzle sees the replacement `0017_great_daredevil` with a newer timestamp and executes it; the first `ALTER TABLE "index_settings" ADD COLUMN "trace_index_id"` fails because the original `0017` already added that column. Migrations run during API startup, so the deployment cannot boot. Restore the original SQL files, snapshots, journal tags, and timestamps, then append a new `0019` migration for the schema and data transition.

### 2. apps/api/src/services/index.service.ts:238

**CONFIRMED** · correctness

getIndexMeta authorizes purely by the named index's own visibility, so a trace index is still directly readable as a log index — the pairing-visibility invariant can be bypassed by naming the trace index in the URL. [same root cause also at: apps/api/src/services/index.service.ts:221]

**Failure scenario:** Admin pairs an admin-only log index to otel-traces-v0_9 (or to any dedicated trace index) expecting spans to inherit that restriction. otel-traces-v0_9 has no index_settings row, so its visibility defaults to 'all' and canAccessIndex returns true for a non-admin. A plain logged-in user calls GET /api/indexes/otel-traces-v0_9/logs?q=* (or /logs/export) and dumps every span in the trace index, including all spans from the admin-only log index. listIndexes now hides trace indexes from the picker, which makes the endpoint look protected when it is not.

### 3. apps/api/src/services/index.service.ts:120

**CONFIRMED** · correctness

assertPairingVisibility only inspects index_settings rows, so log indexes that are paired implicitly by defaultSettings() (no row) are invisible to the same-visibility check it exists to enforce. [same root cause also at: apps/api/src/services/index.service.ts:120, apps/api/src/services/index.service.ts:114, apps/api/src/services/index.service.ts:123, apps/api/src/services/index.service.ts:123, apps/api/src/services/index.service.ts:123]

**Failure scenario:** Fresh install, no index_settings row for otel-logs-v0_9 (so it is implicitly visibility 'all' and implicitly paired to otel-traces-v0_9). An admin creates a restricted index `secure-logs`, sets visibility 'admin' and pairs it to otel-traces-v0_9. The SELECT finds zero rows with trace_index_id = 'otel-traces-v0_9', so no clash is reported and the pairing is accepted. Spans ingested through secure-logs' key now land in otel-traces-v0_9, and any non-admin user can read them via GET /api/indexes/otel-logs-v0_9/traces/<span's traceId> — exactly the cross-visibility span leak the function's own comment says it prevents.

### 4. apps/web/src/routes/(app)/traces/[indexId]/[traceId]/+page.ts:19

**CONFIRMED** · correctness

The new returnTo consumer relies on safeReturnTo, whose `!raw.startsWith('//')` guard misses backslash forms that URL resolution normalizes to protocol-relative, so "Back to logs" becomes an open redirect. [same root cause also at: apps/web/src/routes/(app)/traces/[indexId]/[traceId]/+page.ts:19]

**Failure scenario:** An attacker sends a victim https://rootprint.example/traces/otel-logs-v0_9/<validTraceId>?returnTo=/%5Cevil.com. safeReturnTo accepts it (starts with '/', does not start with '//'), so the page renders <a href="/\evil.com">Back to logs</a>. Resolution normalizes the backslash — new URL('/\\evil.com','https://rootprint.example/x').href === 'https://evil.com/' (verified in this repo's runtime) — so clicking the trusted-looking Back button navigates the authenticated user off-site to the attacker's page, defeating the comment on this very line ("a crafted link can't bounce a user offsite").

### 5. apps/api/src/services/api-key.service.ts:251

**CONFIRMED** · correctness

verifyApiKey resolves the span destination with a leftJoin on index_settings, so it ignores the implicit `defaultSettings()` pairing that every read path honours — a log index with no settings row resolves to null. [same root cause also at: apps/api/src/services/api-key.service.ts:251, apps/api/src/services/api-key.service.ts:247, apps/api/src/services/api-key.service.ts:247, apps/api/src/services/api-key.service.ts:247]

**Failure scenario:** Fresh install (Quickwit auto-created otel-logs-v0_9, no index_settings row yet, migration 0018 updates nothing because there is no row). Admin creates an ingest key for otel-logs-v0_9; CreateApiKeyModal says "Spans from this key go to otel-traces-v0_9" and the api-keys list shows "Spans → otel-traces-v0_9" (both read IndexSummary.traceIndexId, which comes from defaultSettings). The log drawer also shows a working Trace tab (hasTraces=true, GET /api/indexes/otel-logs-v0_9/traces/:id works, since it goes through getIndexSettings). But every OTLP span batch the collector posts to POST /v1/traces is rejected 400 TRACE_INDEX_NOT_CONFIGURED ("Log index \"otel-logs-v0_9\" has no paired trace index"), so no spans are ever ingested while the UI insists they are paired.

### 6. apps/api/src/services/index.service.ts:161

**CONFIRMED** · correctness

saveIndexConfig inserts `{ indexId, ...fields }` rather than the merged settings, so a partial save that omits traceIndexId materializes a row with trace_index_id NULL and silently destroys the implicit default pairing. [same root cause also at: apps/api/src/services/index.service.ts:161, apps/api/src/services/index.service.ts:161, apps/api/src/services/index.service.ts:161, apps/api/src/services/index.service.ts:161, apps/api/src/services/index.service.ts:161]

**Failure scenario:** On an install where otel-logs-v0_9 has no index_settings row, a client calls PUT /api/indexes/otel-logs-v0_9/config with a partial body (every field in saveIndexConfigSchema is optional), e.g. {"displayName":"Application logs"}. The INSERT writes trace_index_id = NULL, so getIndexSettings now returns the row instead of defaultSettings(): hasTraces flips to false, the Trace tab vanishes from the log drawer, and GET /api/indexes/otel-logs-v0_9/traces/:traceId starts returning 404 "This index has no paired trace index." The guard `if (traceIndexId !== existing.traceIndexId) invalidateApiKeyCache()` also cannot fire, because both sides compute to 'otel-traces-v0_9' while the row that was actually written is NULL.

### 7. apps/api/src/services/index.service.ts:324

**CONFIRMED** · correctness

deleteIndex unpairs dependents by UPDATEing index_settings rows only, so an index paired implicitly by defaultSettings() keeps pointing at a trace index that no longer exists. [same root cause also at: apps/api/src/services/index.service.ts:323, apps/api/src/services/index.service.ts:322, apps/api/src/services/index.service.ts:325]

**Failure scenario:** An admin deletes otel-traces-v0_9 while otel-logs-v0_9 has no index_settings row. The UPDATE matches nothing, so getIndexSettings('otel-logs-v0_9') still returns traceIndexId 'otel-traces-v0_9' and hasTraces stays true. Users still see a Trace tab on otel-logs-v0_9 log lines; opening it calls Quickwit's Jaeger get_trace against a deleted index and the pane shows a raw upstream error instead of the tab disappearing (apps/api/AGENTS.md claims "trace tabs disappear cleanly instead of erroring").

### 8. apps/api/src/services/index.service.ts:140

**CONFIRMED** · correctness

saveIndexConfig never rejects traceIndexId === indexId (the self-pairing guard exists only in the Svelte form), and listIndexes filters out every pairing target, so a self-paired index removes itself from the log explorer. [same root cause also at: apps/api/src/services/index.service.ts:149, apps/api/src/schemas/indexes.ts:20]

**Failure scenario:** A client calls PUT /api/indexes/otel-logs-v0_9/config with {"traceIndexId":"otel-logs-v0_9"}. assertPairingVisibility excludes the index itself via ne(indexSettings.indexId, indexId) so it passes. listIndexes then adds otel-logs-v0_9 to `targets` and filters it out for every non-admin view, so the index silently disappears from the log explorer's index picker for all users, and the Trace tab queries Jaeger get_trace against the log index and errors. Recovering requires another API call — the settings form for that index is still reachable, but nothing in the UI explains why the index vanished.

### 9. apps/web/src/lib/api/indexes.ts:43

**CONFIRMED** · correctness

`ingestIndexOptions` derives trace targets only from `traceIndexId` values present in the admin list, unlike the API's `listIndexes` which unconditionally adds `OTEL_TRACES_INDEX`, so a trace index can be offered as an ingest-key destination. [same root cause also at: apps/web/src/lib/api/indexes.ts:42]

**Failure scenario:** Admin who does not use traces sets `otel-logs-v0_9`'s Trace index to "None — this index has no traces", which persists `trace_index_id = NULL`. Now no index in the admin list names `otel-traces-v0_9`, so `traceTargets` is empty and `ingestIndexOptions` returns `otel-traces-v0_9` as a selectable option in both the Create API key modal and the send-logs wizard. The admin creates an ingest key targeting it (the API's `createApiKeySchema` performs no trace-index check either) and points a collector at `/v1/logs`. Log records are written into `otel-traces-v0_9`, but the API's search-view `listIndexes` always strips `OTEL_TRACES_INDEX` from the picker, so those logs never appear in the log explorer for anyone — silently discarded from the user's point of view.

### 10. apps/api/src/services/index.service.ts:146

**PLAUSIBLE** · correctness

saveIndexConfig reads existing settings, calls assertPairingVisibility, then writes — with no transaction or unique constraint spanning the check and the write, so concurrent saves can both pass the visibility invariant.

**Failure scenario:** Two admins (or a script driving PUT /api/indexes/:indexId/config) save simultaneously: request A pairs `public-logs` (visibility all) to `spans-idx` and request B pairs `secret-logs` (visibility admin) to the same `spans-idx`. Both read index_settings at line 121 before either has written, both find no clashing row, both inserts commit. `spans-idx` is now shared by log indexes of differing visibility, so a non-admin reading `public-logs` can fetch spans that arrived through `secret-logs` via GET /api/indexes/public-logs/traces/:traceId — the invariant is permanently violated with no path that re-checks it, since nothing revalidates existing pairings on later reads.

### 11. apps/web/src/lib/page-title.ts:9

**CONFIRMED** · correctness

STATIC_TITLES still keys on the old '/traces/[traceId]' route id, but the route was moved to /traces/[indexId]/[traceId], so the lookup never matches. [same root cause also at: apps/web/src/lib/page-title.ts:9, apps/web/src/lib/page-title.ts:9, apps/web/src/lib/page-title.ts:9, apps/web/src/lib/page-title.ts:9, apps/web/src/lib/page-title.ts:9]

**Failure scenario:** A user opens /traces/otel-logs-v0_9/<traceId>. routeKey('/(app)/traces/[indexId]/[traceId]') yields '/traces/[indexId]/[traceId]', which is not in STATIC_TITLES and is not in the settings breadcrumb manifest, so resolveTitle returns the bare app name. The browser tab reads "Rootprint" instead of "Trace · Rootprint", making trace tabs indistinguishable from every other page in a user's tab strip and in history/bookmarks.

### 12. apps/api/src/services/index.service.ts:221

**PLAUSIBLE** · correctness

The old visibility-only search-view filter was replaced by one that also drops every pairing target plus an unconditional otel-traces-v0_9, removing those indexes from the log explorer for all users including admins.

**Failure scenario:** A user has a bookmarked or shared log-explorer URL of the form /?index=otel-traces-v0_9 (or any index an admin later pairs as a trace target). listIndexes no longer returns that index, so SearchStore.selectedIndex ('URL's index if it's in the indexes list, otherwise the first available') silently falls back to indexes[0]. The page renders a different index's logs under the same URL with no error, no notice, and no way to select the original index from the picker — previously the index appeared whenever canAccessIndex allowed it.

### 13. apps/api/src/schemas/traces.ts:6

**PLAUSIBLE** · correctness

`TRACE_ID_RE` accepts only 32 lowercase hex characters, and the same constant gates both the drawer's Trace tab (`isTraceId`) and the route param validator, so any index whose admin-configured `traceIdField` holds uppercase hex or a dashed id silently loses trace support with no diagnostic anywhere.

**Failure scenario:** An admin pairs a non-OTLP log index to a trace index and sets `traceIdField` to `attributes.correlation_id`, where the application logs `4BF92F3577B34DA6A3CE929D0E0E4736` (uppercase hex, as several log formatters emit) or a dashed form. In `LogDetailDrawer`, `isTraceId(getByPath(hit.raw, 'attributes.correlation_id'))` returns false for every hit, so `traceId` stays null, `hasTrace` is false, and the Trace tab is never rendered — the admin sees the pairing saved successfully in Settings but no traces in the UI, with nothing logged and no hint that the field value was rejected rather than missing. Reaching the standalone page directly at `/traces/<indexId>/4BF92F35...` returns 400 'Expected a 32-character lowercase hexadecimal trace id that is not all zeros', which is the only place the case sensitivity surfaces, and the drawer never reaches it.

### 14. apps/api/drizzle/0018_pair_otel_logs_with_otel_traces.sql:18

**CONFIRMED** · correctness

The `NOT EXISTS` subquery the migration's comment presents as the safeguard for the same-visibility pairing invariant is structurally dead — it can never evaluate to false, because 0017 adds `trace_index_id` in the same release with no default, so every `index_settings` row is NULL when 0018 runs.

**Failure scenario:** Migrations run in sequence (`runMigrations` at boot), so at the moment 0018 executes, 0017's `ALTER TABLE "index_settings" ADD COLUMN "trace_index_id" text` has just added a nullable column with no default and nothing has written to it. The subquery's predicate `other."trace_index_id" = 'otel-traces-v0_9'` therefore matches zero rows for every deployment, so `NOT EXISTS` is always true and the visibility comparison on line 23 is never reached. The migration's comment ("only when it cannot break the same-visibility invariant that assertPairingVisibility enforces") reads as if a real check is being performed, so a future reviewer relaxing 0017 or adding a pre-0018 backfill would believe a guard exists where none does; conversely the actual exposure the invariant targets — `otel-traces-v0_9` carrying its own more-restrictive `index_settings.visibility` while the now-paired `otel-logs-v0_9` is `all` — is not examined at all.

### 15. deploy.sh:18

**CONFIRMED** · cleanup

rsync of the whole working tree to the production host excludes only literal `.env`, not other env files or local agent/doc scratch directories.

**Failure scenario:** Running ./deploy.sh copies .env.local, .env.production, docs/ (gitignored specs/plans), .superpowers/ and .claude/worktrees/ (which per project memory can contain entire sibling checkouts) into /opt/rootprint-build on the live server, and --delete makes the transfer authoritative. Secrets and unrelated local state land on a production box, and the sync is far larger than the build context needs; excluding by allowlist (or using `git archive`/`git ls-files`) sends only tracked build inputs.

### 16. apps/api/src/routes/ingest/otlp.ts:123

**CONFIRMED** · cleanup

The destinationIndex null-guard is dead for the logs signal and carries a trace-specific error message that would be wrong if it fired.

**Failure scenario:** apiKey.indexId is NOT NULL, so for signal 'logs' the `if (!destinationIndex)` branch is unreachable dead code; if it ever were reached it would answer 'Log index "" has no paired trace index, so this key cannot send spans' on a log ingest request. The simpler form is to resolve and null-check inside a `signal === 'traces'` branch only, leaving the logs path as `apiKey.indexId` with no guard.
