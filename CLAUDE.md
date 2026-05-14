# Logwiz

## Project Overview

Logwiz is an open-source logging UI tool built on top of [Quickwit](https://quickwit.io). It is organized as a Bun-workspace monorepo under `apps/`.

- **Backend** (`apps/api`): Hono on Bun. Drizzle ORM + PostgreSQL, Better Auth, Quickwit via `quickwit-js`, Valibot, pino, buf/protobuf. 
- **Frontend** (`apps/web`): Svelte 5 + SvelteKit. Tailwind v4 + DaisyUI. Calls `apps/api` over HTTP.
- **Marketing** (`apps/landing`): SvelteKit static site for logwiz.io.
- **Docs** (`apps/docs`): Mintlify site for docs.logwiz.io.

## Project Configuration

| Setting         | Value                                             |
| --------------- | ------------------------------------------------- |
| Language        | TypeScript (strict, extends `tsconfig.base.json`) |
| Package Manager | bun (workspaces under `apps/*`)                   |
| Backend stack   | hono, drizzle, better-auth, valibot, pino, buf    |
| Frontend stack  | svelte 5, sveltekit, tailwindcss v4, daisyui      |

## Rules

### Types

- Backend (apps/api): shared types in `apps/api/src/types.ts`; re-exported via `exports['./types']`. Cross-workspace consumers import as `import type { ... } from 'api/types'`.
- Frontend (apps/web): app types in `apps/web/src/lib/types.ts`.
- Pure types only — no runtime exports in `types.ts` files.

### Data Loading (apps/web)

Data loading in `apps/web` should be handled in dedicated files alongside the page component (only if practical and not overcomplicated):

| File                | When to use                                             |
| ------------------- | ------------------------------------------------------- |
| `+page.server.ts`   | Needs secrets, auth, cookies, or private backend access |
| `+page.ts`          | Needs browser-only APIs or client-side state            |
| `+layout.server.ts` | Data shared across many pages                           |

This guidance is SvelteKit-specific and only applies inside `apps/web`.

### Tests

Do not write tests for this project. No unit, integration, or end-to-end tests are needed in any workspace — skip test authoring unless explicitly requested.

---

You are able to use the Svelte MCP server when working in `apps/web` or `apps/landing`, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

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
