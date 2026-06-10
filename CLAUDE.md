# Rootprint

## Project Overview

Rootprint is an open-source logging UI tool built on top of [Quickwit](https://quickwit.io). It is organized as a Bun-workspace monorepo under `apps/`.

- **Backend** (`apps/api`): Hono on Bun. Drizzle ORM + PostgreSQL, Better Auth, Quickwit via `quickwit-js`, Valibot, buf/protobuf.
- **Frontend** (`apps/web`): Svelte 5 + SvelteKit. Tailwind v4 + DaisyUI. Calls `apps/api` over HTTP.

## Project Configuration

| Setting         | Value                                             |
| --------------- | ------------------------------------------------- |
| Language        | TypeScript (strict, extends `tsconfig.base.json`) |
| Package Manager | bun (workspaces under `apps/*`)                   |
| Backend stack   | hono, drizzle, better-auth, valibot, buf          |
| Frontend stack  | svelte 5, sveltekit, tailwindcss v4, daisyui      |

## Rules

### Types

- Backend (apps/api): shared types in `apps/api/src/types.ts`; re-exported via `exports['./types']`. Cross-workspace consumers import as `import type { ... } from 'api/types'`.
- Frontend (apps/web): app types in `apps/web/src/lib/types.ts`.
- Pure types only — no runtime exports in `types.ts` files.

### Data Loading (apps/web)

`apps/web` is an SPA built with `@sveltejs/adapter-static`. There is no server runtime — the api (`apps/api`) is the only backend. Therefore:

| File                                  | When to use                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `+page.ts` / `+layout.ts`             | All data loading. Calls `hc<AppType>` or `authClient`. |
| `+page.server.ts` / `hooks.server.ts` | **Do not use** — adapter-static has no server.         |

The Hono RPC client lives in `apps/web/src/lib/api/client.ts`. The Better Auth client lives in `apps/web/src/lib/auth-client.ts`. Cookies are same-origin in both dev (Vite proxy → api) and prod (api serves the SPA).

This guidance is SvelteKit-specific and only applies inside `apps/web`.

### Tests

Do not write tests for this project. No unit, integration, or end-to-end tests are needed in any workspace — skip test authoring unless explicitly requested.

---

You can use the Svelte MCP server when working in `apps/web`, where you have access to Svelte 5 and SvelteKit documentation.

## Available MCP Tools (use when working in Svelte workspaces)

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending the code to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## More

See [more details](./AGENTS.md).
