# apps/web — Agent Guide

## About

Log viewer UI served by the product. SvelteKit with `@sveltejs/adapter-static`, a client-rendered SPA (`index.html` fallback, no SSR or prerendering) with no server runtime. The Hono backend in `apps/api` is the only backend; `apps/web` talks to it over HTTP.

For repo-wide rules (Bun, Prettier, TS strict, tests policy), see the root `AGENTS.md`. For Svelte 5 patterns and the Svelte MCP server, see [Svelte 5 Patterns](#svelte-5-patterns). For UI work and the DaisyUI MCP server, see [Design System](#design-system).

## Stack

- SvelteKit 2 + Svelte 5
- `@sveltejs/adapter-static`
- Tailwind v4 via `@tailwindcss/vite`
- DaisyUI 5 (custom `rootprint` theme — see Design System below)
- Better Auth client + Hono RPC client
- Valibot for client-side validation (schemas re-exported from `api/schemas`)
- `lucide-svelte` icons; `@iconify-svelte/logos` for third-party brand marks only
- `svelte-sonner` toasts, `uplot` charts (through `ui/uplot`), `shiki` code highlighting

## Run, Build, Check

```bash
bun --filter web dev              # vite dev (proxies /api to apps/api)
bun --filter web build            # static build
bun --filter web preview          # preview the built SPA
bun --filter web check            # svelte-kit sync && svelte-check
bun --filter web lint             # oxlint
```

## Source Layout

| Path                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `src/routes/`                        | SvelteKit pages and layouts                                 |
| `src/routes/(app)/`                  | Authenticated product routes (group layout)                 |
| `src/routes/(app)/settings/(admin)/` | Admin-only settings                                         |
| `src/routes/auth/`                   | Sign-in, first-time admin setup                             |
| `src/lib/api/client.ts`              | Hono RPC client (`hc<AppType>`)                             |
| `src/lib/api/<resource>.ts`          | Typed wrappers per API resource; throw `ApiError`           |
| `src/lib/auth-client.ts`             | Better Auth client                                          |
| `src/lib/components/ui/`             | Shared UI kit (see [Shared Components](#shared-components)) |
| `src/lib/components/<feature>/`      | Feature components (`log`, `trace`, `search`, `admin`, …)   |
| `src/lib/attachments/`               | Shared `{@attach}` DOM behaviour                            |
| `src/lib/stores/`                    | Shared state (`search.svelte.ts`, request guards)           |
| `src/lib/utils/`                     | Pure helpers (formatting, query params, colors)             |
| `src/lib/types.ts`                   | App-local types (pure types only)                           |
| `src/app.html`                       | HTML shell + boot loader                                    |
| `src/app.css`                        | Tailwind entry, DaisyUI theme, tokens, named classes        |
| `svelte.config.js`, `vite.config.ts` | Tooling configs                                             |

## Data Loading

`apps/web` is an SPA built with `adapter-static`. There is no server runtime — `apps/api` is the only backend.

- All data loading lives in `+page.ts` / `+layout.ts`.
- Do **not** add `+page.server.ts` or `hooks.server.ts` — `adapter-static` has no server.
- Auth: `authClient` from `$lib/auth-client`.
- API: call the wrappers in `$lib/api/<resource>.ts`. Each one calls the typed Hono RPC `client` and throws `ApiError` through `readApiError` on a non-2xx response. Add a wrapper there instead of calling `client` from a page or component.
- Cookies are same-origin in both dev (Vite proxy → api) and prod (api serves the SPA).

### Error handling

Loaders (`+page.ts` / `+layout.ts`) follow one of three conventions, chosen by intent:

- **Bubble (default):** let the error propagate to the root `+error.svelte`. Use for generic failures with no special handling.
- **`error(status, msg)`:** call it, don't `throw` it (SvelteKit 2 throws internally). Use only to surface a _meaningful_ HTTP status/message (e.g. mapping an `ApiError` 404 to "Index not found"). See `routes/(app)/settings/(admin)/indexes/[indexId]/+page.ts`.
- **Return a discriminated result** (e.g. `{ error: 'not_found' | 'forbidden' | 'unknown' }`): use only when the page renders its own inline error UI instead of the global error page. See `routes/(app)/s/[code]/+page.ts`.

Do not add `try/catch` to a loader unless it implements one of the two non-default conventions for a deliberate reason.

## Svelte 5 Patterns

- Use runes: `$props`, `$state`, `$derived`, `$effect`, `$bindable`.
- `<script lang="ts">` everywhere.
- Use `{@attach ...}`, not `use:`, for your own DOM behaviour. `use:` is reserved for third-party actions that ship no attachment (currently only `svelte-dnd-action`). Shared attachments go in `$lib/attachments/`; one-offs stay local to the component.
- Attachments are fully reactive — `{@attach foo(bar)}` tears down and re-runs whenever `bar` changes. When the value changes often (a keystroke) or the caller passes a fresh closure each render (a virtualised row), take a **getter** and read it inside the attachment instead: `{@attach foo(() => bar)}`. See `$lib/attachments/row-activate.ts`.
- For deeper Svelte 5 / SvelteKit guidance, use the Svelte MCP server: call `list-sections` first, then `get-documentation` for every section whose `use_cases` match the task.

## Design System

The style is **Clean UI** (the DaisyUI MCP trend of that name) applied to a data-dense work tool: a neutral white canvas, hairlines instead of shadows, one brand accent, status colors only for status, and hierarchy carried by size, spacing and alignment rather than decoration. Consistency beats novelty. Before adding a new pattern, reuse an existing one.

### DaisyUI MCP

Use the `daisyui-blueprint` MCP server for any new or changed DaisyUI markup:

1. `daisyui_setup_expert`: `projectRoot` is the absolute path of `apps/web`, one `workflowId` per task. Leave `install` and `fonts` off; the theme and fonts already exist.
2. `daisyui_rules_enforcer`.
3. For a new complete page only: `daisyui_creative_director` with `trend: "Clean UI"`, then `daisyui_page_architect`.
4. `daisyui_component_syntax_expert` with every component you will touch, before writing markup. Don't guess class names.
5. `daisyui_quality_inspector` with `auditIntent: "fix_changes"` and paths relative to `apps/web`. If you aren't previewing in a browser, pass `renderedReview` as `unavailable` instead of starting a dev server for it.

When Creative Director is active, the inspector requires `originalityEvidence`. Pass this instead of inventing one:

```json
{
	"concept": "A calm, dense workbench for reading logs and traces; consistency across screens beats novelty.",
	"domainAnchor": "Log lines, spans and fields are the content; chrome stays neutral so the data carries the page.",
	"signatureElement": "Brand green appears once per surface, on the primary action or the active nav rail.",
	"compositionRule": "PageHeader, then hairline panels on a 4px spacing grid; hierarchy by size and spacing, not color."
}
```

**This file wins over the MCP's generic rules.** Known overrides:

- One theme. No dark theme, `theme-controller` or `prefersdark`.
- The tokens outside the DaisyUI theme (`muted`, `subtle`, `*-ink`, `line`, `--chart-N`, `--trace-service-N`) are sanctioned.
- The [named classes](#named-classes) in `app.css` are sanctioned. The MCP's no-authored-CSS rule applies to everything else.
- Creative Director's originality, imagery, editorial-layout, eyebrow and landing-page motion guidance doesn't apply. No heroes, asymmetry, handwriting fonts or signature flourishes.
- The app is desktop-only (see [Page Composition](#page-composition)), so the MCP's mobile rules don't apply.
- Icons go where they help scanning (navigation, familiar actions, search and filter controls, status), not on every label.

### Theme

A single DaisyUI 5 custom theme named `rootprint` is the source of truth. It is declared in `src/app.css` via `@plugin "daisyui/theme"` and applied through `data-theme="rootprint"` in `src/app.html`. It is light and flat, with a single brand-green accent. Don't add a second theme or a `data-theme` override anywhere.

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
- Fixed palettes are for data only: `--chart-N` for chart series in order, `--trace-service-N` through `serviceColor()` for spans, and `$lib/constants/level-colors.ts` for log levels.

### Typography

- Sans: **Geist**. Mono: **Geist Mono**. Self-hosted variable woff2 under `static/fonts/`, loaded via `@font-face` in `app.css`.
- Two weights: 400 and 500 (`font-medium`). No `font-semibold` or `font-bold`.
- Large text carries hierarchy by size, compact text by weight.

| Style                     | Size, weight      | Use                                                         |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| `text-h1`                 | 40/48, 400, tight | Page title, one per page (through `PageHeader`)             |
| `text-h2`, `text-display` | 32, 64; 400       | Rare large headings (auth, onboarding, error page)          |
| `text-h3`                 | 24/32, 400        | Workbench page title (monitoring, trace detail)             |
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

- `lucide-svelte` only. `@iconify-svelte/logos` is for third-party brand marks (integration logos), never for UI icons.
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
| Result of an action (saved, failed) | `toast.success` / `toast.error` from `svelte-sonner`                                   |
| Switching panels                    | `tab-underline` on tab buttons or links (see `admin/indexes/IndexTabs`)                |
| Grouped controls                    | `join` + `join-item`                                                                   |
| Menu, picker, popover               | `dropdown` on a `popover` element opened by `popovertarget` (see `ui/TimeRangePicker`) |
| Dialog                              | the `ui/Modal` family (native `<dialog>`)                                              |
| Loading                             | `loading loading-spinner loading-xs` inline, `skeleton` for panels                     |
| Hint on an icon-only control        | `tooltip`                                                                              |

Buttons: `btn-sm` in toolbars and panels, `btn-xs` in dense rows, the default size in modal footers and on auth pages. `btn-ghost` for secondary actions, `btn-primary` for the one primary action, `btn-error` only to confirm a destructive action.

### Shared Components

Check `$lib/components/ui/` before writing markup. The second time a pattern appears, move it there instead of copying it.

| Component                                                  | Use for                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `PageHeader`                                               | Breadcrumb, `h1`, description and actions at the page top  |
| `SearchInput`                                              | Every search box                                           |
| `SortButton`                                               | Sortable table headers                                     |
| `Field`, `SelectField`, `TagInput`                         | Stacked form fields with label, hint and error             |
| `SettingsRow`                                              | Label-left, control-right settings rows                    |
| `Modal`, `FormModal`, `ConfirmModal`, `TypeToConfirmModal` | Dialogs, form dialogs, confirmations, destructive confirms |
| `ListCard`, `ListRow`                                      | Hairline lists of linked records                           |
| `EmptyPanel`, `PanelError`                                 | Empty and failed panels (`PanelError` retries)             |
| `CopyButton`, `CopyableField`, `DisplayField`              | Copyable and read-only values                              |
| `SecretReveal`, `OneTimeKeyReveal`                         | Secrets and newly created keys                             |
| `TimeRangePicker`, `TimeRangeTabs`, `RowLimitSelector`     | Time range and row limit controls                          |
| `FieldRow`                                                 | Key/value rows with filter and copy actions                |
| `TracesLink`                                               | Icon-only row link into the Traces explorer                |
| `UserIdentity`                                             | Avatar, name and email                                     |
| `uplot/UplotLinePanel`                                     | Time-series charts (built on `UplotChart`, `UplotLegend`)  |

### Named Classes

Defined in `src/app.css`. Add one only when DaisyUI plus utilities can't express it and several places need it.

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
- Form-level errors render as an `alert alert-error` at the top.
- The global focus style in `app.css` replaces DaisyUI's 2px ring with a 1px `base-content` border shift. Same footprint, no visual jump. Don't add `focus:ring-*` to form controls.

### Page Composition

- Every page starts with `ui/PageHeader`: breadcrumb, `text-h1` title, `text-muted text-sm` description, optional actions on the right.
- Workbench pages (logs, traces, trace detail, monitoring) are the exception: they open with their toolbar. When one shows a title, it is a `.section-label` context line over a `text-h3` title, mono when the title is an operation name.
- Settings pages wrap their content in `.settings-page`.
- Content sits in hairline panels. Sections open with a `.section-label` or a `text-base font-medium` heading.
- One primary action per surface.
- Every panel that loads data has a loading state (`skeleton` or spinner), an empty state (`EmptyPanel`) and an error state (`PanelError`).
- Metadata grid: sentence-case `<dt class="text-muted text-xs">` labels and sans values, reserving `<dd class="font-mono text-sm">` for IDs, timestamps and code.
- The app is desktop-only: below `48rem` the root layout renders a desktop-size notice instead of route content. That is exactly Tailwind's `md` breakpoint, so **`sm:` and `md:` variants never apply** inside the app; their unprefixed values are dead code. Reach for `lg:`/`xl:` or a container query when a surface really needs to reflow.

## Error Handling

- SvelteKit `+error.svelte` at the root catches uncaught route errors. Match its heading pattern if you add nested error boundaries.
- API errors: the `$lib/api` wrappers throw `ApiError` carrying the parsed `ApiErrorBody`. Surface `error.message`, and map `details[].path` to fields with `toFormErrors` from `$lib/api/errors` (`issuesToFieldErrors` does the same for client-side Valibot issues). See `routes/auth/setup-admin/+page.svelte` for the canonical flow.
- Validate inputs with the Valibot schemas re-exported from `api/schemas` so client and server agree on shape.

## Tests

No automated tests in this workspace. Authentication is covered by the API suite in `apps/api/tests/`. Manual visual review remains `bun --filter web dev` or `bun --filter web preview`.

## Conventions

- TS strict (extends `tsconfig.base.json`).
- Single quotes, tabs, no trailing commas (Prettier).
- `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` normalize Svelte files and class-attribute order — let them.
- Use SvelteKit aliases (`$lib`, `$app`, `$env`) over deep relative paths.
- Cross-workspace types: `import type { ... } from 'api/types'`. Schemas: `import { ... } from 'api/schemas'`.
- Component callback props are camelCase (`onSave`, `onToggleSort`); lowercase only when the prop mirrors a native DOM event on an element the component wraps (`Modal`'s `onclose`/`oncancel`).
- `.svelte.ts` modules are kebab-case (`metrics-poller.svelte.ts`), like all other `.ts` files.
