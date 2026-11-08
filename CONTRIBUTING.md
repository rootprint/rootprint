# Contributing to Rootprint

Thanks for contributing to Rootprint. This repository is a Bun-workspace monorepo with two workspaces under `apps/`: the API server (`apps/api`) and the web app (`apps/web`). Keeping changes focused and well-explained makes reviews faster and safer.

## Ways to contribute

- Report bugs with clear reproduction steps
- Improve docs or developer tooling
- Submit focused bug fixes or small features
- Pick up issues marked as good first issue or help wanted when available

## Before you start

- Search existing issues and pull requests before opening a new one
- For larger changes, open an issue first so maintainers can confirm the direction
- Keep pull requests scoped to a single change when practical

## Development environment

Rootprint uses Bun as its package manager and runtime.

Prerequisites:

- Bun `1.4.0` (the version pinned by `packageManager` in `package.json`)
- Docker with Compose support
- Git

## Local setup

```bash
bun install
cp .env.example .env
docker compose up -d db quickwit
bun --filter api db:migrate
bun run dev:api
bun run dev:web
```

Notes:

- Every env var, required or optional, is documented in `.env.example`.
- `FRONTEND_URL` (used by `apps/api` for CORS) defaults to `http://localhost:5173`. Override it when running behind a reverse proxy or under a non-default deployment.

## Repository layout

- `apps/api/` - Hono API: ingest, search proxy, auth, admin operations
- `apps/web/` - SvelteKit SPA: Logs, Traces, Services, Send data and Settings

## Development guidelines

- Use TypeScript with strict typing. Avoid `any` unless unavoidable.
- Backend types: `apps/api/src/types.ts`. Frontend types: `apps/web/src/lib/types.ts`.
- Backend routes follow the Hono pattern in `apps/api/src/routes/*.ts`. Service logic in `apps/api/src/services/*.service.ts`.
- Automated tests cover authentication only, in `apps/api/tests/`. Changes to sign-in, sessions, API keys, invites, provider settings or boot must add or update a test there. Verify other changes manually.
- Match the existing code style:
  - tabs for indentation
  - single quotes
  - no trailing commas
- Keep changes minimal. Do not mix unrelated refactors into a functional change.

## Useful commands

```bash
bun --filter <workspace> dev      # dev server for one workspace
bun --filter '*' check            # type-check every workspace
bun run format                    # prettier write
bun run format:check              # prettier check (CI uses this)
```

Per-workspace builds:

```bash
bun --filter api build
```

Database and auth utility commands live in `apps/api`:

```bash
bun --filter api db:generate
bun --filter api db:migrate
bun --filter api db:studio
```

Proto regeneration (after upstream OTEL or googleapis refresh):

```bash
bun --filter api proto:gen
```

## Before opening a pull request

Run the same core checks that CI runs:

```bash
bun --filter '*' check
bun run lint
bun run format:check
bun --filter api build
bun --filter web build
bun --filter api test
```

`bun --filter api test` needs `docker compose up -d --wait db quickwit`.

## Pull request expectations

- Explain the problem and why the change is needed
- Link related issues when applicable
- Update docs when setup, configuration, or user-facing behavior changes
- Include screenshots or short recordings for UI changes when helpful
- Make sure CI is green before requesting review

## Reporting bugs

Please include:

- what you expected to happen
- what happened instead
- exact reproduction steps
- environment details when relevant

Clear reports and narrowly scoped pull requests are the fastest way to get a contribution merged.
