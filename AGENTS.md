# AGENTS.md

Guidance for autonomous coding agents working in `logwiz`.

## Project Snapshot

Logwiz is a Bun-workspace monorepo. Workspaces live under `apps/`. The Hono backend in `apps/api` is the API layer. The SvelteKit log-viewer UI lives in `apps/web` and talks to `apps/api` over HTTP. `apps/landing` and `apps/docs` are independent static sites.

## Workspace Map

| Path           | Purpose                                      | Stack                                          | AGENTS.md                            |
| -------------- | -------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| `apps/api`     | Backend service (ingest, search proxy, auth) | Hono, Drizzle, Better Auth, valibot, pino, buf | `apps/api/AGENTS.md`                 |
| `apps/web`     | Log viewer UI                                | SvelteKit (Svelte 5), Tailwind v4, DaisyUI     | Not yet — workspace is mid-migration |
| `apps/landing` | Marketing site (logwiz.io)                   | SvelteKit static, Tailwind v4, DaisyUI         | `apps/landing/AGENTS.md`             |
| `apps/docs`    | User docs (docs.logwiz.io)                   | Mintlify                                       | `apps/docs/AGENTS.md`                |

## Source of Truth

- Toolchain and root scripts: `package.json`.
- Formatting: `.prettierrc`.
- TS base config: `tsconfig.base.json` (every workspace extends it).
- CI: `.github/workflows/ci.yml`.
- Team-wide rules: `CLAUDE.md`.
- Stack-specific rules: each workspace's `AGENTS.md`.

## Install and Run

```bash
bun install
cp .env.example .env
docker compose up quickwit -d
bun --filter api db:migrate
bun run dev:api        # or: bun --filter <workspace> dev
```

Root convenience scripts: `dev:api`, `build:api`, `start:api`, `check`, `lint`, `format`, `format:check`. Workspace-specific scripts run via `bun --filter <workspace> <script>`.

## Shared Rules (all workspaces)

- Bun only. Engine-strict (`bun >= 1.0.0`). Do not use npm/pnpm/yarn.
- TypeScript is strict. Every workspace extends `tsconfig.base.json`. Avoid `any` unless unavoidable.
- Prettier config is at the repo root: tabs, single quotes, no trailing commas, line width ~100.
- No automated tests in any workspace — no unit, integration, or end-to-end tests.
- For stack-specific rules (Hono routing, Svelte 5 patterns, Mintlify writing standards), see the relevant workspace's `AGENTS.md`.

## CI Parity Before Merge

```bash
bun --filter '*' check
bun run lint
bun run format:check
bun --filter api build
```

## Database and Auth Commands (apps/api)

```bash
bun --filter api db:generate     # generate migration from schema diff
bun --filter api db:migrate      # apply migrations
bun --filter api db:studio       # open Drizzle Studio
```

## Formatting and Style

- Tabs (not spaces) for indentation.
- Single quotes.
- No trailing commas.
- Line width around 100 chars.
- Let Prettier and (in Svelte workspaces) `prettier-plugin-svelte` normalize formatting.
- `apps/docs/`, `static/`, and `drizzle/` are ignored by Prettier.

## TypeScript Guidelines

- Strict TS; avoid `any` unless unavoidable.
- Prefer `unknown` in catches and narrow with `instanceof` / type guards.
- Export explicit input/output types for shared helpers/services.
- Use `import type` for type-only imports.
- Use Valibot for runtime validation; infer types from schemas where possible.
- Cross-workspace types: import from `api/types` (re-exported via `exports['./types']` in `apps/api/package.json`).

## Import Conventions

- Keep imports at top of file.
- In Svelte workspaces, prefer SvelteKit aliases (`$lib`, `$app`, `$env`) over deep relative paths.
- In `apps/api`, relative imports use `.js` extensions (NodeNext module resolution).
- Add new imports to the nearest logical group instead of reordering entire files.

## Naming and File Conventions

- Components: PascalCase `.svelte` (e.g. `LogDetailDrawer.svelte`).
- Utilities: kebab-case `.ts` (e.g. `query-params.ts`).
- API services: `*.service.ts` in `apps/api/src/services`.
- API routes: one file per resource in `apps/api/src/routes`.
- API schemas: Valibot schemas per concern, colocated near routes/services.
- Variables/functions: camelCase. Constants: UPPER_SNAKE_CASE.

## Error Handling Conventions

- `apps/api`: throw `HttpError` from `src/utils/http-error.ts`; the central `app.onError` translates it to JSON or OTLP. Never return raw 500s with internals.
- `apps/web` (when wired up): use SvelteKit `error(status, message)` and `redirect(...)`; validate form input with Valibot.
- Do not silently swallow errors unless fallback behavior is intentional.

## Cursor and Copilot Rules

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.

## Agent Workflow Checklist

- Read the relevant workspace's `AGENTS.md` first.
- Make minimal, localized changes that match existing patterns.
- Run CI parity checks before handing off major changes.
- If schema or proto contracts change, run the relevant generation commands (`db:generate`, `proto:gen`).
