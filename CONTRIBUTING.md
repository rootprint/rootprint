# Contributing to Logwiz

Thanks for contributing to Logwiz. This repository contains the main application, the
marketing site, and the docs site, so keeping changes focused and well-explained makes reviews
faster and safer.

## Ways to contribute

- Report bugs with clear reproduction steps
- Improve docs, tests, or developer tooling
- Submit focused bug fixes or small features
- Pick up issues marked as good first issue or help wanted when available

## Before you start

- Search existing issues and pull requests before opening a new one
- For larger changes, open an issue first so maintainers can confirm the direction
- Keep pull requests scoped to a single change when practical

## Development environment

Logwiz uses Bun as its package manager and runtime.

Prerequisites:

- Bun `>= 1.0.0`
- Docker with Compose support
- Git

## Local setup

```bash
bun install
cp .env.example .env
docker compose up quickwit -d
bun run db:push
bun run dev
```

Notes:

- `LOGWIZ_QUICKWIT_URL` is required. The default local value is already provided in
  `.env.example`.
- `ORIGIN` is optional and is usually only needed behind a reverse proxy or when enforcing a
  canonical public URL.
- Additional optional settings are documented in `.env.example`.

## Repository layout

- `./` - main Logwiz application
- `site/` - marketing site
- `docs-site/` - documentation site
- `tests/` - automated tests

## Development guidelines

- Use TypeScript with strict typing. Avoid `any` unless it is genuinely unavoidable.
- Put shared app types in `src/lib/types.ts`.
- Keep server-only logic in the server layer and follow the existing remote function pattern in
  `src/lib/api/*.remote.ts`.
- Add tests in `tests/` for behavior changes.
- Match the existing code style:
  - tabs for indentation
  - single quotes
  - no trailing commas
- Keep changes minimal. Do not mix unrelated refactors into a functional change.

## Useful commands

```bash
bun run dev
bun run lint
bun run check
bun run test
bun run format
```

Examples for running a single Vitest file or test:

```bash
bun run test -- tests/lib/query.test.ts
bun run test -- tests/lib/query.test.ts -t "parses single include clause"
```

If you change database or auth contracts, the following commands may also be relevant:

```bash
bun run db:push
bun run db:generate
bun run db:migrate
bun run auth:schema
```

## Before opening a pull request

Run the same core checks that CI runs:

```bash
bun run lint
bun run check
bun run test
LOGWIZ_QUICKWIT_URL=http://placeholder:7280/api/v1 bun run build
```

## Pull request expectations

- Explain the problem and why the change is needed
- Link related issues when applicable
- Add or update tests for behavior changes
- Update docs when setup, configuration, or user-facing behavior changes
- Include screenshots or short recordings for UI changes when helpful
- Make sure CI is green before requesting review

## Reporting bugs

Please include:

- what you expected to happen
- what actually happened
- exact reproduction steps
- environment details when relevant

Clear reports and narrowly scoped pull requests are the fastest way to get a contribution merged.
