# apps/web Frontend Rewrite — Design

**Date:** 2026-05-15
**Branch:** `api-rewrite`
**Scope:** Port the existing SvelteKit frontend (currently at the repo root on `main`) into the new `apps/web` workspace on `api-rewrite`, on top of the Hono backend in `apps/api`.

## Context

`api-rewrite` restructured the project into a Bun monorepo. The Hono backend in `apps/api` is implemented. `apps/web` currently has only an SPA scaffold: auth (sign-in, setup-admin), an authenticated layout, and a dashboard stub. The full product UI — log viewer, indexes admin, send-logs guides, tokens, users, Google OAuth admin, saved queries, shares, history — still lives on `main`'s repo-root SvelteKit app.

The rewrite flips three axes simultaneously:

1. **SSR → SPA.** `@sveltejs/adapter-static`. No `+page.server.ts`, no `hooks.server.ts`. Hono is the only backend.
2. **Remote functions → Hono RPC.** The old `$lib/api/*.remote.ts` files are replaced by direct `hc<AppType>` calls.
3. **Old DaisyUI / theme → new `logwiz` design system.** Flat, hairline borders, mono micro-text, regular-weight headings, single brand-green accent. Defined in `apps/web/src/app.css` and `apps/web/AGENTS.md`.

## Goals

- Restore every feature shipped on `main` in the new workspace.
- Restyle to the new design system throughout, with minor layout-only adjustments allowed for the log viewer's denser surfaces.
- Take **targeted UX cleanup** while porting: simplify duplicated form/modal shells, drop dead code paths, consolidate similar list rows. No new features.
- Keep the URL and storage shape used by saved queries and shared links so existing share URLs round-trip.

## Non-Goals

- No tests (project rule).
- No new features beyond what `main` ships.
- No Storybook / visual-regression / accessibility audit pass.
- No i18n, no PWA / offline, no second theme.

## Overall Shape

Eight phases, smallest viable. Each phase ships either infrastructure or a user-visible feature area. The product is usable end-to-end once Phases 0 + 1 + 4 land; Phases 2/3/5/6/7 fill out admin and viewer satellites.

```
Phase 0 — Infra & app shell
Phase 1 — Indexes administration
Phase 2 — Ingest tokens
Phase 3 — Users & auth admin (incl. Google OAuth)
Phase 4 — Log viewer (core)
Phase 5 — Saved queries, history, views
Phase 6 — Shared links
Phase 7 — Send-logs guides (Caddy, Docker, Fluent Bit, Go, HTTP, JS, Nginx, Python, Vector, Zig)
```

**Why this order:**

- Phase 0 first matches the chosen "infra first" sequencing and unblocks every later phase.
- Admin (1–3) before viewer (4): admin pages are simpler, exercise the RPC + form + table patterns at low risk, and produce the modal/copy/table components the viewer reuses.
- Viewer (4) before its satellites (5–6): saved queries, history, and shares all consume the viewer's URL/state shape — that shape must be stable first.
- Send-logs (7) last: each guide is independent and mostly static, easy to parallelize, safe to defer.

---

## Phase 0 — Infra & app shell

The only phase with no user-visible feature. Five units of work, each independently mergeable inside the phase.

### 0.1 Typed RPC + error helpers (`apps/web/src/lib/api/`)

- Keep `client.ts` as-is (`hc<AppType>('')`).
- Add a thin `call()` helper that parses `ApiErrorBody` on non-2xx and throws a typed `ApiError` with `.message`, `.fieldErrors: Record<string, string>`, `.status`. This canonicalizes the inline mapping the current `auth/setup-admin/+page.svelte` does by hand.
- **No** per-endpoint "service" wrappers. Pages call `api.api.<path>.$get/$post(...)` directly, wrapped by `call()`. The old `*.remote.ts` indirection duplicated typings the RPC client now provides — do not reintroduce it.

### 0.2 App shell (`routes/(app)/+layout.svelte`)

- Top header (logo, user menu, sign-out), left rail nav (Logs, Administration), main content area.
- Active-route highlight via `$app/state` `page.url.pathname`.
- Shell-only components live in `$lib/components/shell/`.

### 0.3 Administration sub-shell (`routes/(app)/administration/+layout.svelte`)

- Admin breadcrumbs + secondary nav (Indexes, Tokens, Users, Authentication, Send Logs).
- `(app)/administration/+layout.ts` enforces `session.user.role === 'admin'` and redirects non-admins to `/`.

### 0.4 UI primitives audit (`$lib/components/ui/`)

Per the per-component-audit decision, the proposal is:

- **Port + restyle (keep API):** `ConfirmModal`, `TypeToConfirmModal`, `CopyButton`, `CopyableField`, `CodeBlock`, `InlineCode`, `Callout`, `QuickwitStatusBanner`.
- **Replace with DaisyUI-native + thin wrapper:** `Modal` → DaisyUI `<dialog>`; `Drawer` → DaisyUI `drawer`; `CollapsibleSection` → `<details>` + tokens.
- **Defer to Phase 4:** `Calendar`, `JsonHighlight` (only the viewer consumes them).
- Mount `svelte-sonner` `<Toaster>` once in `routes/+layout.svelte`.

### 0.5 Shared utilities (`$lib/utils/`, `$lib/constants/`)

Port the pure-function utilities now, in groups:

- **time:** `time.ts`, `format.ts`, `histogram.ts`
- **query:** `query-params.ts`, `query.ts`, `lucene.ts`
- **misc:** `debounce.ts`, `error.ts`, `avatar.ts`

Defer `field-resolver.ts`, `fields.ts`, `traceback-parser.ts`, `column-width.ts`, `wrap-mode.ts` to Phase 4.

Constants: port `routes.ts`, `severity.ts`, `storage-keys.ts`, `defaults.ts` now; defer `builtin-views.ts`, `index-stats.ts`, `ingest.ts` to their owning feature phases.

### 0.6 Dependencies added in Phase 0

`lucide-svelte`, `svelte-sonner`, `date-fns`. (`valibot` already present.)

### Phase 0 exit criteria

- A signed-in user lands on `/`, sees the app shell with nav.
- Clicking "Administration" renders the admin sub-shell (empty pages OK).
- A non-admin is redirected away from admin routes.
- `bun --filter web check` and `bun --filter web lint` pass.

---

## Phase 1 — Indexes administration

- **Routes:** `(app)/administration/indexes/+page`, `(app)/administration/indexes/[indexId]/+page` (Overview / Config / Fields / Sources tabs).
- **RPC:** `api.api.indexes.$get`; `.:indexId.$get/$patch/$delete`; `.:indexId.sources` PATCH/DELETE; `.:indexId.fields.$get`.
- **Components:** `IndexList`, `IndexTabs`, `IndexOverviewTab`, `IndexConfigTab`, `IndexFieldsTab`, `IndexSourcesTab`, `SourceActionsMenu`, `DeleteIndexModal`, `DeleteSourceModal`. The four `IndexStatsRow*` + `IndexStatsDeltaChip` + skeleton port together — they are tightly coupled.
- **UX cleanups in scope:** collapse the four `IndexStatsRow{Loaded,Error,Skeleton}` files into one component with a `state` discriminator; drop `IndexStatsCell` if it has a single caller.

## Phase 2 — Ingest tokens

- **Route:** `(app)/administration/tokens/+page`.
- **RPC:** `api.api['ingest-tokens'].$get/$post`; `.:id.$get/$delete`.
- **Components:** `TokensManagement`, `CreateTokenModal`, `ViewTokenModal` (one-time secret reveal via `CopyButton`), `DeleteTokenModal`.
- **UX cleanup:** the three modals share most of their shell — consider one `TokenModal` with a `mode` prop. Decide while porting based on whether their state machines differ enough to justify separation.

## Phase 3 — Users & auth admin

- **Routes:** `(app)/administration/users/+page`; `(app)/administration/authentication/+page`; `(app)/administration/authentication/google/+page`.
- **RPC:** `api.api.users.$get/$delete`; `.:userId.role.$put`; `.:userId['password-resets'].$post`; `api.api.settings['auth/google'].*`; `api.api.invites.$post`; `.:id.resend.$post`.
- **Components:** `UserManagement`, `InviteUserModal`, `RemoveUserModal`, `ChangePasswordModal`, `ResetPasswordModal`, `MemberActionsMenu`, `AuthProviderRow`, `GoogleAuthForm`, `RemoveGoogleAuthModal`.
- Pulls in any missing pieces of `/auth/setup` / `/auth/setup-admin` invite flows.

## Phase 4 — Log viewer (core)

The largest phase. The viewer replaces the existing `(app)/+page.svelte` dashboard stub. Internal order:

1. URL-driven query state — confirm Phase 0's `query-params.ts` / `query.ts` / `lucene.ts` cover the viewer's needs; port `stores/search.svelte.ts` (coordinates query / time / index / results / histogram / scroll).
2. Layout primitives — `OverlayScrollbarsComponent` host, three-pane split (toolbar / chart / results + drawer / sidebar field panel).
3. `SearchToolbar`, `QueryInput`, `TimeRangePicker` (port `Calendar` here), `ColumnSettings`.
4. `LogFrequencyChart` (histogram), `LogHeader`, `LogRow` (+ `wrap-mode`, `column-width`, `field-resolver`, `fields`, `format`, `severity`).
5. `LogDetailDrawer`, `LogContextView`, `TracebackView` (+ `JsonHighlight`, `traceback-parser`).
6. `FieldPanel` (left sidebar field stats).

- **RPC:** `api.api.indexes[':indexId'].logs.$get`; `.logs.histogram.$get`; `.fields[':field'].values.$get`.
- **Visual:** follows the design system in `apps/web/AGENTS.md`. Minor layout-only adjustments are permitted where AGENTS.md is silent (sticky headers, draggable column widths, compact row chrome). Same tokens, same typography, no new colors, no shadows.
- **UX cleanups:** prune any dead code paths in `search.svelte.ts`; revisit `storage-keys.ts` for stale entries.
- **Phase exit:** signed-in user picks an index, types a query, sees histogram + rows, clicks a row to see JSON detail.
- **Dependencies added this phase:** `overlayscrollbars`, `overlayscrollbars-svelte`, and whatever charting library `LogFrequencyChart` uses on `main` (verify when porting — likely `uplot` or a custom SVG renderer).

## Phase 5 — Saved queries, history, views

- **Components:** `HistoryDrawer`, `HistoryTab`, `SavedTab`, `SharedTab` (drawer with three tabs), `DrawerList`, `DrawerRow`, `SaveQueryModal`, `SaveViewModal`, `ViewPicker`.
- **RPC:** `api.api['saved-queries'].*`; `api.api.preferences.*`.
- History remains client-side (localStorage), as on `main`.
- **UX cleanup:** consolidate the three tabs' row chrome through a single `DrawerRow`.

## Phase 6 — Shared links

- **Route:** `(app)/share/[code]/+page` — read-only viewer of a shared hit and its surrounding context.
- **RPC:** `api.api.shares['/'].$post`; `.:code.$get`.
- Reuses `LogDetailDrawer` / `LogContextView` from Phase 4.
- "Share" button in `SearchToolbar` is wired up here (or at the tail of Phase 5 — pick during scoping).

## Phase 7 — Send-logs guides

- **Routes:** `(app)/administration/send-logs/+page` (gallery) + 10 flavor routes: Caddy, Docker, Fluent Bit, Go, HTTP, JavaScript, Nginx, Python, Vector, Zig.
- **RPC:** needs an ingest-token list to populate snippets — reuse Phase 2's calls.
- **Components:** `SendLogsFlavorTabs`, `SendLogsSourceCard`, `SendLogsSourceShell`, `SendLogsStep`, `SendLogsTokenCallout`, `VerifySearchStep`.
- The 10 flavor pages are highly parallel; each can be its own sub-task. Step count per page is not capped at four — each flavor uses as many steps as the content needs.

---

## Cross-Cutting Concerns

### Error contract

Every page handles errors identically: `try { call() } catch (e: ApiError) { formError = e.message; fieldErrors = e.fieldErrors }`. The current `auth/setup-admin/+page.svelte` is the reference. Phase 0's `call()` helper enforces this — no per-page bespoke handling allowed in later phases.

### Schemas

Client validation always uses schemas re-exported from `api/schemas`. If a feature phase needs a schema the API does not yet export, add the export to `apps/api/src/schemas/index.ts` as part of that phase. Never duplicate schemas in `apps/web`.

### No `+page.server.ts`

Every load is `+page.ts` / `+layout.ts`. Hard rule for `apps/web` per the root `CLAUDE.md` — adapter-static has no server. Auth gating uses `(app)/+layout.ts` (already in place); admin gating goes in `(app)/administration/+layout.ts` (Phase 0).

### URL and storage shape

Saved queries and shared links encode state in the URL. Phase 4 inherits `main`'s URL shape so existing share URLs round-trip. Phase 0 ports `query-params.ts` and `storage-keys.ts` unchanged. UX cleanups that *break* either shape are out of scope unless flagged and decided explicitly.

### Toasts

`svelte-sonner` `<Toaster>` mounts once in `routes/+layout.svelte` (Phase 0). Feature phases call `toast.success` / `toast.error` for one-shot feedback only. Form errors stay inline (alert chip + field micro-text), not toasts.

### Routes that do not port

`main`'s `src/routes/api/*` endpoints (`export`, `ingest`, `otlp`, `health`) belong to `apps/api` and are already there. The web app links to API endpoints by URL but does no server work.

### Dependencies per phase

| Phase | New dependencies |
|-------|------------------|
| 0     | `lucide-svelte`, `svelte-sonner`, `date-fns` |
| 1–3   | none |
| 4     | `overlayscrollbars`, `overlayscrollbars-svelte`, charting lib (verify on porting) |
| 5–7   | none expected |

Keep package.json deltas reviewable; avoid pulling heavy deps before their phase.

---

## Open Questions

- Final picks for the per-component audit in Phase 0.4 may shift once the actual `main` components are read line-by-line. Decisions documented in commit messages / phase plan.
- Charting library for `LogFrequencyChart`: confirm what `main` uses; carry it over or replace if it's now a one-import dependency.
