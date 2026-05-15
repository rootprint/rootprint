# apps/web — Agent Guide

## About

Log viewer UI served by the product. SvelteKit with `@sveltejs/adapter-static` — fully prerendered SPA, no server runtime. The Hono backend in `apps/api` is the only backend; `apps/web` talks to it over HTTP.

For repo-wide rules (Bun, Prettier, TS strict, no tests), see the root `AGENTS.md`. For Svelte 5 patterns and the Svelte MCP server, see the root `CLAUDE.md`.

## Stack

- SvelteKit 2 + Svelte 5
- `@sveltejs/adapter-static`
- Tailwind v4 via `@tailwindcss/vite`
- DaisyUI 5 (custom `logwiz` theme — see Design System below)
- Better Auth client + Hono RPC client
- Valibot for client-side validation (schemas re-exported from `api/schemas`)

## Run, Build, Check

```bash
bun --filter web dev              # vite dev (proxies /api to apps/api)
bun --filter web build            # static build
bun --filter web preview          # preview the built SPA
bun --filter web check            # svelte-kit sync && svelte-check
bun --filter web lint             # oxlint
```

## Source Layout

| Path                                 | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `src/routes/`                        | SvelteKit pages and layouts                    |
| `src/routes/(app)/`                  | Authenticated product routes (group layout)    |
| `src/routes/auth/`                   | Sign-in, first-time admin setup                |
| `src/lib/api/client.ts`              | Hono RPC client (`hc<AppType>`)                |
| `src/lib/auth-client.ts`             | Better Auth client                             |
| `src/lib/types.ts`                   | App-local types (pure types only)              |
| `src/app.html`                       | HTML shell + boot loader + Google Fonts        |
| `src/app.css`                        | Tailwind entry + DaisyUI theme + design tokens |
| `svelte.config.js`, `vite.config.ts` | Tooling configs                                |

## Data Loading

`apps/web` is an SPA. There is no server runtime — see the root `CLAUDE.md` "Data Loading" table.

- All data loading lives in `+page.ts` / `+layout.ts`.
- Do **not** add `+page.server.ts` or `hooks.server.ts` — `adapter-static` has no server.
- Auth: `authClient` from `$lib/auth-client`.
- API: `api` from `$lib/api/client` (typed Hono RPC).

## Svelte 5 Patterns

- Use runes: `$props`, `$state`, `$derived`, `$effect`, `$bindable`.
- `<script lang="ts">` everywhere.
- For deeper Svelte 5 / SvelteKit guidance, the Svelte MCP server is documented in the root `CLAUDE.md`.

## Design System

### Theme

A single DaisyUI 5 custom theme named `logwiz` is the source of truth. It is declared in `src/app.css` via `@plugin "daisyui/theme"` and applied through `data-theme="logwiz"` in `src/app.html`. The theme is light, flat, and uses a single brand-green accent.

Do not introduce a second theme or add a `data-theme` override elsewhere. If you need a dark surface, use `base-content` or `neutral` — don't fork the theme.

### Color Roles

Use semantic DaisyUI classes (`bg-base-100`, `text-base-content`, `btn-primary`, …) — never the raw hex values. The current mapping:

| Role           | Use for                                                |
| -------------- | ------------------------------------------------------ |
| `base-100`     | App canvas (white)                                     |
| `base-200`     | Elevated panels, cards, the auth card                  |
| `base-300`     | Field backgrounds, dividers                            |
| `base-content` | Default text                                           |
| `primary`      | Brand-green action — primary buttons, focal highlights |
| `secondary`    | Dark-green text on green, or inverted accent contexts  |
| `accent`       | Blue informational accent (used sparingly)             |
| `neutral`      | Strong neutral surface (e.g. inverted dark button)     |
| `info`         | Code-identifier blue                                   |
| `success`      | Confirmation                                           |
| `warning`      | Caution                                                |
| `error`        | Field/form errors                                      |

The brand-green is the visual signature. Use it for one primary CTA per surface — not for decoration.

### Typography

- Sans: **Roboto**. Mono: **Roboto Mono**. Loaded via `<link>` in `app.html`.
- Body is `0.875rem / 1.5rem` (14px / 24px) — small and data-dense by default.
- Headings are **regular weight (400)** with **tight tracking** at large sizes. Do not use `font-bold` on headings — the size carries the hierarchy, not the weight. The base layer in `app.css` already sets `font-weight: 400` and `letter-spacing: -0.02em` on `h1–h4`; let it do its job.
- Tokens `text-display`, `text-h1`, `text-h2`, `text-h3` are available via Tailwind v4's `@theme` for arbitrary headings outside the HTML hierarchy.
- Mono text is for: code, IDs, timestamps, small metadata labels, eyebrows. Not for body prose.

### Material — Flat

- No shadows. Do not add `shadow-*` utilities. Elevation is implied by `base-200` surfaces and the `.hairline` border, not by drop shadow.
- Small radii: `rounded` (4px) for fields and controls, `rounded-box` (8px) for cards. Avoid `rounded-xl`/`rounded-2xl`/`rounded-full` except for genuine pill/avatar shapes.
- `--depth: 0` and `--noise: 0` are set on the theme. Don't override them.

### Reusable Component Classes

Defined in `src/app.css` under `@layer components`:

- `.eyebrow` — uppercase mono micro-label used **above** a heading. Use it instead of `<small>` or a second `<p>` to introduce the page/section.
- `.hairline` — 1px border at 10% of `base-content`. Use to frame cards, panels, dividers on the light canvas. Replaces `shadow-*` for elevation.

Compose them with Tailwind utilities, e.g. `class="hairline rounded-box p-8"`.

### Forms

- For inputs with adornments use DaisyUI 5's `<label class="input">` floating-label pattern (`label` span + bare `<input>` child). Do not use ad-hoc button-on-input layouts that produce separate floating hover shapes.
- Field-level errors render as **mono micro-text** under the input (`class="text-error font-mono text-xs"`), not inside an alert chip.
- Form-level errors render as a top-of-card `alert alert-error` chip.
- The default 2px DaisyUI focus ring on `.input`/`.select`/`.textarea` is overridden in `app.css` to a 1px `base-content` border-color shift. Same footprint, no visual jump — keep it that way and don't add `focus:ring-*` utilities on form controls.

### Page Composition

Recurring patterns to reach for before inventing new ones:

- **Eyebrow + Heading + Body** — `<p class="eyebrow">…</p>` then `<h1 class="text-3xl tracking-tight">…</h1>` then body. This is the default page-header shape.
- **Hairline panel** — `<div class="hairline rounded-box p-8">…</div>` on `base-200` for any framed content. The auth card and the home session panel both use this.
- **Mono metadata grid** — when listing key/value metadata (emails, IDs, timestamps), use a `grid` of `<dt class="text-base-content/50 text-xs uppercase tracking-wider">` + `<dd class="font-mono text-sm">`. See `routes/(app)/+page.svelte`.

### What Not to Do

- Don't add `shadow-xl` (or any shadow) to cards.
- Don't use `font-bold` on headings — the regular weight at large size is intentional.
- Don't hard-code hex values in Svelte files; use DaisyUI semantic classes.
- Don't add `focus:ring-*` to form controls — the global `.input` focus state is already defined.
- Don't introduce a new theme or a per-component `data-theme` override.
- Don't reintroduce DaisyUI's `card`/`card-body` for shells — they pull a different radius and padding scale. Use the `hairline + rounded-box + p-8` recipe.

## Error Handling

- SvelteKit `+error.svelte` at the root catches uncaught route errors. It already uses the eyebrow/heading pattern — match it if you add nested error boundaries.
- API errors: parse `ApiErrorBody` from `api/types` and surface `error.message` (and `details[].path` for field-level mapping) — see `routes/auth/setup-admin/+page.svelte` for the canonical flow.
- Validate inputs with the Valibot schemas re-exported from `api/schemas` so client and server agree on shape.

## Tests

No tests. Manual visual review via `bun --filter web dev` or `bun --filter web preview`.

## Conventions

- TS strict (extends `tsconfig.base.json`).
- Single quotes, tabs, no trailing commas (Prettier).
- `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` normalize Svelte files and class-attribute order — let them.
- Use SvelteKit aliases (`$lib`, `$app`, `$env`) over deep relative paths.
- Cross-workspace types: `import type { ... } from 'api/types'`. Schemas: `import { ... } from 'api/schemas'`.
