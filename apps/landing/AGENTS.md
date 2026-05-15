# apps/landing — Agent Guide

## About

Marketing site served at logwiz.io. SvelteKit with `adapter-static` — fully prerendered to static HTML. Independent from `apps/web` (the product UI) and `apps/docs` (Mintlify user docs).

For repo-wide rules (Bun, Prettier, TS strict, no tests), see the root `AGENTS.md`. For Svelte 5 patterns and the Svelte MCP server, see the root `CLAUDE.md`.

## Stack

- SvelteKit 2 + Svelte 5
- `@sveltejs/adapter-static`
- Tailwind v4 via `@tailwindcss/postcss`
- `@tailwindcss/typography`
- DaisyUI 5
- `super-sitemap`

## Run, Build, Check

```bash
bun --filter landing dev          # vite dev
bun --filter landing build        # static build
bun --filter landing preview      # preview the built site
bun --filter landing check        # svelte-kit sync && svelte-check
bun --filter landing format       # prettier write (with prettier-plugin-svelte)
bun --filter landing format_check # prettier check
```

## Source Layout

| Path                                                   | Purpose                                            |
| ------------------------------------------------------ | -------------------------------------------------- |
| `src/routes/`                                          | SvelteKit pages (landing, pricing, features, etc.) |
| `src/lib/`                                             | Components and helpers shared across pages         |
| `src/app.html`                                         | HTML shell                                         |
| `src/app.css`                                          | Tailwind entry; global styles                      |
| `src/config.ts`                                        | Site-level config (canonical URL, nav, etc.)       |
| `static/`                                              | Public assets served at the root                   |
| `svelte.config.js`                                     | SvelteKit config (uses `adapter-static`)           |
| `vite.config.ts`, `postcss.config.js`, `tsconfig.json` | Tooling configs                                    |

## Content Scope

- Marketing copy, landing pages, pricing/feature pages.
- **Not** for product docs — those live in `apps/docs`. If you find yourself writing how-to-use-the-product content here, move it to `apps/docs`.

## Svelte 5 Patterns

- Use runes: `$props`, `$state`, `$derived`, `$effect`, `$bindable`.
- Keep component scripts typed (`<script lang="ts">`).
- Prefer small presentational components.
- For deeper SvelteKit and Svelte 5 guidance, see the Svelte MCP server section in the root `CLAUDE.md`.

## Styling

- Tailwind v4 utilities + DaisyUI 5 components.
- For inputs with adornments (icon, button, etc.) use DaisyUI's `<label class="input">` and `join` patterns rather than ad-hoc button-on-input layouts.
- Use `@tailwindcss/typography` for long-form prose where it fits.

## Tests

No tests. Manual visual review via `bun --filter landing preview`.

## Conventions

- TS strict (extends `tsconfig.base.json`).
- Single quotes, tabs, no trailing commas (Prettier).
- Prettier formats Svelte files automatically via `prettier-plugin-svelte`.
- Use SvelteKit aliases (`$lib`, `$app`, `$env`) over deep relative paths.
