# apps/web — Agent Guide

Log viewer UI: a client-rendered SvelteKit SPA built with `@sveltejs/adapter-static` (`index.html` fallback, no SSR or prerendering). `apps/api` is its only backend.

## Where code goes

- Routes: `src/routes/(app)/` holds the authenticated product, `(app)/(admin)/` the admin-only pages (settings, send data) behind one role guard, and `auth/` sign-in and first-time setup. A new admin page also gets an entry in `src/lib/admin-nav.ts`, which builds that group's nav and breadcrumbs. A static route beside a user-named dynamic segment takes a name no ID can have (`settings/indexes/_new` beside `[indexId]`); otherwise it shadows that ID.
- Feature code lives in `src/lib/components/<feature>/`, named after the UI section (`logs`, `traces`, `services`, `profile`, `settings`, `send-data`, `shell`, `auth`), together with the helpers only that feature uses. Put such a helper in the deepest subfolder that holds all its importers.
- `src/lib/utils/` holds helpers used by two or more features, by `ui/` or `shell/`, by `lib/api/`, or by another shared helper. `lib/api/` counts as its own area, so what it imports stays in `utils/`.
- Shared `{@attach}` behaviour goes in `src/lib/attachments/`, shared state in `src/lib/stores/`, app-local types in `src/lib/types.ts` (pure types only).

## Data Loading

There is no server runtime, so all data loading lives in `+page.ts` / `+layout.ts`; `+page.server.ts` and `hooks.server.ts` have nothing to run them.

- Auth: `authClient` from `#lib/auth-client`.
- API: call the wrappers in `#lib/api/<resource>.ts`. Each one calls the typed Hono RPC `client` and throws `ApiError` through `readApiError` on a non-2xx response. Add a wrapper there instead of calling `client` from a page or component.
- Cookies are same-origin in both dev (Vite proxy → api) and prod (api serves the SPA).
- SvelteKit never aborts a load. A loader that streams a search promise also returns `cancel` (aborting that request's `AbortController`), and the page returns it from an `$effect` so new data or leaving the page stops the search (see `routes/(app)/services/+page.ts`). Links into those pages set `data-sveltekit-preload-data="tap"`: a hover preload that never navigates has no page to cancel its search.
- Client-side fetching that follows URL state outside a loader (the logs store, `lib/components/logs/search.svelte.ts`) starts each request in an `$effect` that reads `$derived` inputs and cancels it in that effect's teardown (aborting its `AbortController`, or setting a `stale` flag when the API wrapper takes no signal), with no request guards or dedupe keys.

### Error handling

Loaders (`+page.ts` / `+layout.ts`) follow one of three conventions, chosen by intent:

- **Bubble (default):** let the error propagate to the root `+error.svelte`. Use for generic failures with no special handling. Match that page's heading pattern if you add a nested error boundary.
- **`error(status, msg)`:** call it, don't `throw` it (it throws internally). Use only to surface a _meaningful_ HTTP status/message (e.g. mapping an `ApiError` 404 to "Index not found"). See `routes/(app)/(admin)/settings/indexes/[indexId]/+layout.ts`.
- **Return a discriminated result** (e.g. `{ error: 'not_found' | 'unknown' }`): use only when the page renders its own inline error UI instead of the global error page. See `routes/(app)/s/[code]/+page.ts`.

Add `try/catch` to a loader only to implement one of the two non-default conventions. Use `redirect(...)` for route guards.

In components, surface an `ApiError`'s `error.message`, and map `details[].path` to fields with `toFormErrors` from `#lib/api/errors` (`issuesToFieldErrors` does the same for client-side Valibot issues). Validate input with the Valibot schemas re-exported from `api/schemas` so client and server agree on shape. See `routes/auth/setup-admin/+page.svelte` for the canonical flow.

## Svelte 5 Patterns

- Use runes: `$props`, `$state`, `$derived`, `$effect`, `$bindable`.
- `<script lang="ts">` everywhere.
- Use `{@attach ...}`, not `use:`, for your own DOM behaviour. `use:` is reserved for third-party actions that ship no attachment (currently only `svelte-dnd-action`). Shared attachments go in `#lib/attachments/`; one-offs stay local to the component.
- Attachments are fully reactive — `{@attach foo(bar)}` tears down and re-runs whenever `bar` changes. When the value changes often (a keystroke) or the caller passes a fresh closure each render (a virtualised row), take a **getter** and read it inside the attachment instead: `{@attach foo(() => bar)}`. See `#lib/attachments/row-activate.ts`.

## Design System

The style is **Clean UI** applied to a data-dense work tool: a neutral white canvas, hairlines instead of shadows, one brand accent, status colors only for status, and hierarchy carried by size, spacing and alignment rather than decoration. Consistency beats novelty. Before adding a new pattern, reuse an existing one.

### Theme

A single DaisyUI 5 custom theme named `rootprint` is the source of truth. It is declared in `src/app.css` via `@plugin "daisyui/theme"` and applied through `data-theme="rootprint"` in `src/app.html`. It is light and flat, with a single brand-green accent. It is the only theme: no dark theme, `theme-controller`, `prefersdark` or `data-theme` override anywhere.

### Color

Use semantic classes (`bg-base-100`, `text-muted`, `btn-primary`, …), never raw hex values in Svelte files.

| Role                      | Use for                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `base-100`                | Canvas, sidebar, and every overlay (dropdowns, modals, drawers, tooltips)   |
| `base-200`                | Row hover (`/60`), zebra rows (`/50`), inset fills (code, read-only fields) |
| `base-300`                | Selected row, pressed state, meter tracks                                   |
| `base-content`            | Default text                                                                |
| `primary`                 | Brand green: one primary action per surface, the active nav rail            |
| `secondary`               | Dark green: text on green, chart series 1                                   |
| `accent`                  | Blue informational accent (used sparingly)                                  |
| `neutral`                 | Strong neutral surface (e.g. inverted dark button)                          |
| `info`                    | Code-identifier blue fill                                                   |
| `success` / `warning`     | Confirmation / caution fills                                                |
| `error`                   | Errors and destructive actions; reserved for them in charts too             |
| `muted`                   | Secondary text: labels, descriptions, inactive navigation                   |
| `subtle`                  | Tertiary text: metadata, hints                                              |
| `info-ink`, `warning-ink` | Blue and warning text on light surfaces                                     |
| `line`                    | Every hairline (`border-line`, `divide-line`)                               |

- Text is `text-base-content`, `text-muted` or `text-subtle`. Never dim text with opacity (`text-base-content/60`); the tokens hold WCAG AA contrast on `base-100` and `base-200`. Disabled controls use DaisyUI's disabled state.
- Dimming a whole row, region or series to show state (loading, filtered out, hidden, disconnected, off-screen) with `opacity-*` is fine; it is not a text colour.
- A control inside a coloured badge (a filter chip's invert or remove button) may rest at `opacity-60` and go to full on hover: a text token would drop the badge's tint.
- `info`, `accent` and `warning` are fills. For text on light surfaces use the `-ink` variants.
- Color never carries meaning alone. Pair a status color with text, an icon or a shape.
- Fixed palettes are for data only: `--chart-N` for chart series in order, `--trace-service-N` through `serviceColor()` for spans, and `#lib/constants/level-colors.ts` for log levels.

### Typography

- Sans: **Geist**. Mono: **Geist Mono**. Self-hosted variable woff2 under `static/fonts/`, loaded via `@font-face` in `app.css`.
- Two weights: 400 and 500 (`font-medium`). No `font-semibold` or `font-bold`.
- Large text carries hierarchy by size, compact text by weight.

| Style                     | Size, weight      | Use                                                         |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| `text-h1`                 | 40/48, 400, tight | Page title, one per page (through `PageHeader`)             |
| `text-h2`, `text-display` | 32, 64; 400       | Rare large headings (auth, onboarding, error page)          |
| `text-h3`                 | 24/32, 400        | Detail page title (trace detail)                            |
| `text-xl tabular-nums`    | 20/28, 400        | KPI and headline numbers                                    |
| `text-base font-medium`   | 16/24, 500        | Panel, section and modal headings (`h2`–`h4` inside a page) |
| `text-sm`                 | 14/24, 400        | Body default, navigation, forms                             |
| `text-ui`                 | 13/20, 400        | Compact controls and dense rows                             |
| `.section-label`          | 12/18, 500, muted | Section openers, chart titles, table headers, breadcrumbs   |
| `text-xs`                 | 12/16, 400        | Metadata, hints, field errors                               |

- Sentence case everywhere. No uppercase or letter-spaced labels; use `.section-label`.
- Nothing smaller than `text-xs`.
- Mono is for code, queries, IDs, timestamps and log payloads; sans everywhere else. Use `tabular-nums` for aligned numbers rather than making their labels monospace.

### Surfaces and Shape

- Flat. Separate regions with `border-line` hairlines and the `base-200` fill, not shadows. `--depth: 0` and `--noise: 0` stay.
- One shadow level, `shadow-lg`, only on overlays that float over content without a dimmed backdrop (popovers, chart tooltips, the log drawer). Modals have a backdrop and stay `shadow-none` (see `ui/Modal`).
- One kind of line per surface: hairline row dividers or zebra rows, never both. Tables split rows with `border-line` hairlines and `hover:bg-base-200/60`; zebra is reserved for the trace waterfall.
- 4px radii: `rounded-box` for panels and overlays, `rounded` for small controls, `rounded-sm` for chips inside text. `rounded-full` only for pills: badges, status dots, avatars, segmented controls. No `rounded-md`/`lg`/`xl`.
- Hairline panel: `border-line rounded-box border` with no fill, rows split by `divide-line divide-y` and padded `px-4 py-3` (see `ui/ListCard`). The auth card is the one filled panel (`bg-base-200 p-8`, see `auth/AuthBackdrop`).
- Don't use DaisyUI's `card`/`card-body`; they bring a different radius and padding scale.

### Icons

- `lucide-svelte` only. `@iconify-svelte/logos` is for third-party brand marks (integration logos), never for UI icons; `@iconify-svelte/simple-icons` covers a mark `logos` lacks (Fluent Bit).
- Icons go where they help scanning (navigation, familiar actions, search and filter controls, status), not on every label.
- Size with a `size-*` class, not the `size` prop: `size-3.5` by default, `size-3` inside `btn-xs`, table headers and dense rows, `size-4` for primary navigation (app sidebar, settings nav, help menu). Larger only for empty-state art and brand logos.
- Icons inherit text color. Tone them with `text-muted`/`text-subtle`, not opacity.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons get an `aria-label` and a matching `title`.

### Motion

- `transition-colors` or `transition-opacity` at Tailwind's default duration (150ms); don't set one. Never `transition-all`.
- The sidebar collapse and DaisyUI's drawer and modal are the only animated layout. Nothing animates on load, and motion never carries meaning by itself.

### Components

Pick the DaisyUI component by behavior:

| Need                                | Use                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Status indicator                    | `status` next to a text label                                                          |
| Short label, count, tag             | `badge badge-sm` (`badge-ghost` or `badge-soft`)                                       |
| Form-level error                    | `alert alert-error` at the top of the form                                             |
| Result of an action (saved, failed) | `toast.success` / `toast.error` from `svelte-sonner` (not copy: see `CopyButton`)      |
| Switching panels                    | `tab-underline` on tab buttons or links (see `settings/indexes/IndexTabs`)             |
| Grouped controls                    | `join` + `join-item`                                                                   |
| Menu, picker, popover               | `dropdown` on a `popover` element opened by `popovertarget` (see `ui/TimeRangePicker`) |
| Dialog                              | the `ui/Modal` family (native `<dialog>`)                                              |
| Loading                             | `loading loading-spinner loading-xs` inline, `skeleton` for panels                     |
| Label on a collapsed sidebar item   | `tooltip tooltip-right` with `data-tip` (see `shell/SidebarNavItem`)                   |

Tabs move focus with Tab and activate with Enter or Space, like any button or link: no arrow-key, Home/End or roving-tabindex handling.

Buttons: `btn-sm` in toolbars and panels, `btn-xs` in dense rows, the default size in modal footers and on auth pages. `btn-ghost` for secondary actions, `btn-primary` for the one primary action, `btn-error` only to confirm a destructive action (`FormModal` takes `destructive` for that).

- Three exceptions keep a border or fill: provider sign-in buttons on the filled auth card are `btn-outline` (ghost vanishes on `base-200`), the button that opens a destructive confirm is `btn-outline btn-error`, and a control floating over content keeps the default fill (the trace minimap's reset zoom).
- Toggles and segmented controls mark the on state with `aria-pressed` (`aria-current` on links), which DaisyUI styles as `btn-active`, plus `btn-neutral`, or the status color when the option is a status (`ExploreToolbar`). Never `btn-primary`; green is for the action. The export dialog's toggles stay `btn-ghost`: the owner rejected the dark fill there.

### Shared Components

List `src/lib/components/ui/` before writing markup, and use its component wherever one fits: every search box is `SearchInput`, every copy action `CopyButton` or `CopyableField` (the icon turns to a check, no toast), every dialog the `Modal` family, every page top `PageHeader` or `PageToolbar`. Admin pages scroll in `PageScroll`, which `.settings-page` queries; `PanelError` takes a retry.

The second time a pattern appears, move it into `ui/` instead of copying it. Fold only true duplicates, the same element with different data; look-alike markup stays separate rather than merging behind positional flags or lookup maps.

### Named Classes

Defined in `src/app.css`. Add one only when DaisyUI plus utilities can't express it and several places need it; that is the only authored CSS.

- `.section-label`: the 12px medium muted label from the type table.
- `.field-label`: the label above a form control (`ui/Field`); reuse it for radio and checkbox `<legend>`s.
- `.settings-page`: centered settings content with padding based on the named `settings` container width. Use it instead of fixed `px-12 py-12` page shells.
- `tab-underline`: underline on the selected tab (`aria-selected`, `aria-pressed` or `aria-current`).
- `nav-rail` with a `.nav-rail-bar` child: the green rail on the current navigation item.
- `--color-line`: the hairline token behind `border-line`, `divide-line` and friends (10% of `base-content`).

### Forms

- Controls with an adornment (icon, button, suffix) use DaisyUI 5's `<label class="input">` wrapper around a bare `<input>` (see `ui/SearchInput`). No button-on-input layouts that produce separate floating hover shapes.
- Every control has a visible label or an `aria-label`.
- Field-level errors render as `text-error text-xs` micro-text under the control (`ui/Field` is the contract), not inside an alert.
- Form-level errors render as an `alert alert-error` at the top. On a page form longer than the viewport, scroll it into view on failure (see `settings/indexes/CreateIndexForm`).
- The global focus style in `app.css` replaces DaisyUI's 2px ring with a 1px `base-content` border shift. Same footprint, no visual jump. Don't add `focus:ring-*` to form controls.

### Page Composition

- Every page is one of three types:
  - **Explorer** (logs, traces, services) opens with `ui/PageToolbar`. Left to right: scope picker, query, filters, then pushed right: time range, run/refresh, page actions. No visible title; an `sr-only` `h1` names the section.
  - **Detail** (trace detail) opens with a back link, then a `.section-label` context line over a `text-h3` title, mono when the title is an operation name.
  - **Admin** (settings, profile, send data) starts with `ui/PageHeader`: breadcrumb, `text-h1` title, `text-muted text-sm` description, optional actions on the right. Content is wrapped in `.settings-page` inside `ui/PageScroll`; the settings layout provides it, pages outside settings add their own.
- Content sits in hairline panels. Sections open with a `.section-label` or a `text-base font-medium` heading.
- One primary action per surface.
- Every panel that loads data has a loading state (`skeleton` or spinner), an empty state (`EmptyPanel`) and an error state (`PanelError`).
- Metadata grid: sentence-case `<dt class="text-muted text-xs">` labels and sans values, reserving `<dd class="font-mono text-sm">` for IDs, timestamps and code.
- The app is desktop-only: below `48rem` the root layout renders a desktop-size notice instead of route content. That is exactly Tailwind's `md` breakpoint, so **`sm:` and `md:` variants never apply** inside the app; their unprefixed values are dead code. Reach for `lg:`/`xl:` or a container query when a surface really needs to reflow.

## Conventions

- Prefer the `#lib` subpath import and SvelteKit's `$app` modules over deep relative paths. Cross-workspace types: `import type { ... } from 'api/types'`; schemas: `import { ... } from 'api/schemas'`.
- Component callback props are camelCase (`onToggleSort`); lowercase only when the prop mirrors a native DOM event on an element the component wraps (`Modal`'s `onclose`/`oncancel`).
- `.svelte.ts` modules are kebab-case (`time-zone.svelte.ts`), like all other `.ts` files.
- Numbers go through `#lib/utils/format`: `formatDurationMs` for whole-millisecond values (percentiles, averages), `formatDurationMicros` for span durations and the log search's elapsed time, `formatRate` for rates, always per minute. Counts are compact (`formatCount`) in tables, KPIs and chart axes, and exact (`toLocaleString()`) where the number itself is the answer: result totals, export, pagination, facet counts, and bar-chart tooltips (`LogFrequencyChart`, `VolumeChart`). `uplot/UplotLinePanel` tooltips reuse the panel's `formatValue`.
- Timestamps go through `#lib/utils/time`: `formatTimestamp` (milliseconds) for log and span times, `formatActivityTimestamp` (seconds) in the activity tables, `formatRelativeTime` (compact: `just now`, `2h ago`, `in 6mo`) for last active, last used and last event, `formatDate` / `formatDateTime` for account dates, `formatTickDate` on chart axes and `formatTooltipDate` in chart tooltips. Time-range labels live in `#lib/utils/time-range`. These follow the user-menu Local/UTC preference (`#lib/stores/time-zone.svelte`), so never call date-fns `format` on an absolute time directly: a new pattern goes through `formatInZone` (it must be a substring of `yyyy-MM-dd HH:mm:ss.SSS`), typed times are parsed with `parseRangeDateTime`, and `UplotChart` places chart ticks in the same zone. Only the date-only `formatDate` stays local. Chart bucket widths come from `bucketSeconds` in `api/time`, which the API's MCP histogram also uses, so one range gets one width everywhere.
