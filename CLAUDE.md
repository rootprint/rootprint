# Logwiz

## Project Overview

Logwiz is an open-source logging UI tool built on top of [Quickwit](https://quickwit.io).

- **Frontend**: Svelte 5 with SvelteKit (Remote Functions for API layer)
- **Auth**: Better Auth
- **Quickwit API**: `quickwit-js` library
- **Styling**: DaisyUI (via Tailwind CSS)

## Project Configuration

| Setting         | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| Language        | TypeScript                                                      |
| Package Manager | bun                                                             |
| Add-ons         | prettier, tailwindcss, drizzle, better-auth, devtools-json, mcp |

## Rules

### Types

- All types must be defined in `src/lib/types.ts`.

### Data Loading

Data loading should be handled in dedicated files alongside the page component(only if possible and not overcomplicated):

| File                | When to use                                             |
| ------------------- | ------------------------------------------------------- |
| `+page.server.ts`   | Needs secrets, auth, cookies, or private backend access |
| `+page.ts`          | Needs browser-only APIs or client-side state            |
| `+layout.server.ts` | Data shared across many pages                           |

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### Tests

All tests has to be located in tests folder.

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## More

See [more details](./AGENTS.md)
