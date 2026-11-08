# AGENTS.md

Rootprint is a Bun-workspace monorepo: the Hono API in `apps/api` and the SvelteKit log viewer in `apps/web`, which talks to it over HTTP.

**Before editing under `apps/api/` or `apps/web/`, read that workspace's `AGENTS.md`.**

## Install and run

```bash
bun install
cp .env.example .env
docker compose up -d db quickwit
bun --filter api db:migrate
bun run dev:api        # and/or: bun run dev:web
```

Scripts live in each `package.json`; run a workspace's with `bun --filter <workspace> <script>`.

## Rules

- Make minimal, localized changes that follow the patterns already in the code.
- Bun only, at the `packageManager` version in `package.json`. CI installs exactly that version and fails `--frozen-lockfile` on a `bun.lock` written by any other.
- Type unknown values as `unknown` and narrow them; reach for `any` only when nothing else works.
- Let errors propagate unless the fallback is deliberate.
- Automated tests cover authentication only. Any change to sign-in, sessions, API keys, invites, provider settings or boot adds or updates a scenario in `apps/api/tests/` (run with `bun --filter api test`, after `docker compose up -d --wait db quickwit`). Add tests elsewhere only when asked.
- After changing a contract, regenerate what depends on it: `bun --filter api db:generate` for the DB schema, `bun --filter api proto:gen` for protos, `bun run openapi:generate` for routes and their schemas (`apps/api/openapi.json` is tracked).

## CI parity

Run before handing off a major change; this is what `.github/workflows/ci.yml` runs:

```bash
bun install --frozen-lockfile
bun audit --audit-level=high
bun run check
bun run lint
bun run format:check
docker compose up -d --wait db quickwit
bun --filter api test
bun --filter web build
bun --filter api build
docker build .
```
