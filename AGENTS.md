# AGENTS.md

Guidance for autonomous coding agents working in `logwiz`.

## Project Snapshot

- Stack: Svelte 5 + SvelteKit 2, TypeScript, Bun, Vitest, Drizzle ORM, Better Auth.
- UI: Tailwind CSS v4 + DaisyUI.
- Search backend: Quickwit via `quickwit-js`.
- API style: SvelteKit Remote Functions in `src/lib/api/*.remote.ts`.
- Package manager: Bun only (`engine-strict=true`, Bun >= 1.0.0).

## Source of Truth

- Scripts and toolchain: `package.json`.
- Formatting: `.prettierrc`.
- TS strictness: `tsconfig.json`.
- Test config: `vitest.config.ts`.
- CI expectations: `.github/workflows/ci.yml`.
- Team rules: `CLAUDE.md`.

## Install and Run

```bash
bun install
cp .env.example .env
docker compose up quickwit -d
bun run db:push
bun run dev
```

## Build, Lint, Typecheck, Test

- `bun run dev` - start local dev server.
- `bun run build` - production build (requires env vars).
- `bun run preview` - preview built app.
- `bun run lint` - Prettier check only.
- `bun run format` - Prettier write.
- `bun run check` - `svelte-kit sync` + `svelte-check` (strict TS checks).
- `bun run test` - run all Vitest tests once.
- `bun run test:watch` - run tests in watch mode.

## Single Test Commands (Vitest)

```bash
bun run test -- tests/lib/query.test.ts
bun run test -- tests/lib/query.test.ts -t "parses single include clause"
bun run test -- src/lib/utils/traceback-parser.test.ts
bun run test -- --coverage
```

## CI Parity Checks Before Merge

```bash
bun run lint && bun run check && bun run test && LOGWIZ_QUICKWIT_URL=http://placeholder:7280/api/v1 ORIGIN=http://placeholder:3000 bun run build
```

## Database and Auth Utility Commands

- `bun run db:push` - push Drizzle schema to DB.
- `bun run db:generate` - generate migrations.
- `bun run db:migrate` - run migrations.
- `bun run db:studio` - open Drizzle Studio.
- `bun run auth:schema` - regenerate Better Auth schema file.

## Required Repo Rules (from CLAUDE.md)

- Define shared app types in `src/lib/types.ts`.
- Keep data loading in dedicated route load files when practical:
  - `+page.server.ts`: secrets/auth/cookies/private backend access.
  - `+page.ts`: browser-only APIs or client-side state.
  - `+layout.server.ts`: shared server-loaded data for many pages.

## Formatting and Style

- Use tabs (not spaces) for indentation.
- Use single quotes.
- Do not add trailing commas.
- Target line width around 100 chars.
- Let Prettier and `prettier-plugin-tailwindcss` normalize formatting/class order.
- Svelte files use the Svelte Prettier parser automatically.
- `docs/`, `static/`, and `drizzle/` are ignored by Prettier.

## TypeScript Guidelines

- TS is strict; avoid `any` unless unavoidable.
- Prefer `unknown` in catches and narrow with `instanceof`/type guards.
- Export explicit input/output types for shared helpers/services.
- Keep file-local helper types local; move reusable domain types to `src/lib/types.ts`.
- Use `import type` for type-only imports.
- Use Valibot schemas for runtime validation and infer types from schemas where possible.

## Import Conventions

- Keep imports at top of file.
- Prefer SvelteKit aliases (`$lib`, `$app`, `$env`) over deep relative paths in app code.
- In tests, relative imports are acceptable for route modules under test.
- Preserve existing import grouping/order in touched files (no enforced auto-sort in repo).
- Add new imports to the nearest logical group instead of reordering entire files.

## Naming and File Conventions

- Components: PascalCase `.svelte` (for example `LogDetailDrawer.svelte`).
- Utilities: kebab-case `.ts` (for example `query-params.ts`).
- Services: `*.service.ts` in `src/lib/server/services`.
- Remote functions: `*.remote.ts` in `src/lib/api`.
- Schemas: one domain file per concern in `src/lib/schemas`.
- Tests: `*.test.ts` under `tests/` or colocated in `src/`.
- Variables/functions: camelCase.
- Constants: UPPER_SNAKE_CASE when truly constant.

## Svelte 5 and SvelteKit Patterns

- Use Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`, `$bindable`).
- Keep component scripts typed (`<script lang="ts">`).
- Prefer small presentational components; keep heavy logic in stores/services/utils.
- Follow existing Remote Function pattern: validate input schema, auth guard, service call.
- Keep auth/session logic in hooks/middleware/server layer, not in client components.

## Error Handling Conventions

- Use SvelteKit `error(status, message)` for HTTP-style failures.
- Use `redirect(...)` for control-flow redirects.
- In form remote functions, use `invalid(issue.field(...))` for validation feedback.
- Translate low-level errors into user-facing messages at API boundary.
- On client side, use toasts/fallback messages (see `getErrorMessage`).
- Do not silently swallow errors unless fallback behavior is intentional.

## Testing Conventions

- Test runner: Vitest (`describe`, `it`, `expect`, `vi`).
- Mock dependencies with `vi.mock(...)` before importing module-under-test.
- Reset mocks in `beforeEach` when needed.
- Prefer behavior-focused test names.
- Keep tests deterministic; avoid network or real external service dependency.

## Security and Runtime Notes

- Required env vars for app/build: `LOGWIZ_QUICKWIT_URL`, `ORIGIN`.
- Auth and rate-limit behavior is centralized in `src/hooks.server.ts`.
- Do not bypass `requireUser()` / `requireAdmin()` for protected remote functions.

## Cursor and Copilot Rules

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.
- No additional Cursor/Copilot instruction files were found in this repository.

## Agent Workflow Checklist

- Read related schema/type/service files before editing.
- Make minimal, localized changes that match existing patterns.
- Run targeted tests first (single file or `-t`) for fast feedback.
- Run CI parity checks before handing off major changes.
- If schema/auth contracts change, run relevant generation commands.
