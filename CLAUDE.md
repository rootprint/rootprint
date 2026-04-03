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

<!-- GSD:project-start source:PROJECT.md -->

## Project

**Logwiz**

An open-source, self-hosted log management platform built on Quickwit. Logwiz provides a fast, simple, and cost-effective alternative to bloated tools like Kibana, Grafana, and Papertrail. Anyone can self-host it to search, explore, and manage their logs through a clean web UI.

**Core Value:** Fast, simple log search and exploration — users find what they need in their logs without fighting the UI or paying for expensive SaaS tools.

### Constraints

- **Tech stack**: Svelte 5 + SvelteKit, Better Auth, quickwit-js, DaisyUI — already established, no migration
- **Runtime**: Bun — used for both package management and production runtime
- **Database**: SQLite via Drizzle ORM — embedded, no external DB dependency
- **Backend engine**: Quickwit — all log storage and search powered by Quickwit API
- **Open-source**: Must remain self-hostable with minimal dependencies
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 - Full codebase including server, API, and client components
- JavaScript (Svelte 5 components and configuration files)

## Runtime

- Node.js-compatible via Bun 1.0.0+ (package manager and runtime)
- Bun 1.0.0+ - Primary package manager
- Lockfile: `bun.lockb` (binary format, committed to repo)

## Frameworks

- Svelte 5.55.0 - Frontend reactive UI framework with runes
- SvelteKit 2.55.0 - Full-stack meta-framework with file-based routing and server functions
- Better Auth 1.4.22 - Authentication framework with email/password and social providers
- Tailwind CSS 4.2.2 - Utility-first CSS framework
- DaisyUI 5.5.19 - Component library built on Tailwind CSS
- Vite Tailwind plugin 4.2.2 - Integration for Tailwind with Vite
- Drizzle ORM 0.45.1 - TypeScript ORM with SQLite support
- Drizzle Kit 0.31.10 - Migration and schema management tooling
- SQLite (via Bun:sqlite) - Local embedded database at `./data/logwiz.db`
- Vite 8.0.2 - Build tool and dev server
- SvelteKit Bun Adapter 1.0.1 - Deployment adapter for Bun runtime
- Svelte Check 4.4.5 - TypeScript and Svelte type checking
- Vitest 4.1.1 - Unit and integration test runner
- Vitest Coverage v8 4.1.1 - Code coverage reporting (LCOV and text output)
- Prettier 3.8.1 - Code formatter
- Prettier Plugin Svelte 3.5.1 - Svelte formatting support
- Prettier Plugin Tailwind CSS 0.7.2 - Tailwind class sorting
- Vite Plugin DevTools JSON 1.0.0 - Development tooling plugin (dev mode only)

## Key Dependencies

- `quickwit-js` 0.3.6 - JavaScript client for Quickwit API interaction (core functionality)
- `better-auth` 1.4.22 - Authentication and authorization with plugins for admin, username, and social login
- `drizzle-orm` 0.45.1 - Database ORM with query builder pattern
- `uplot` 1.6.32 - Lightweight charting library for log frequency visualization
- `lucide-svelte` 0.577.0 - SVG icon library with Svelte integration
- `svelte-dnd-action` 0.9.69 - Drag-and-drop utilities for Svelte
- `svelte-sonner` 1.1.0 - Toast notification library
- `overlayscrollbars` 2.14.0 and `overlayscrollbars-svelte` 0.5.5 - Custom scrollbar styling
- `nanoid` 5.1.7 - URL-friendly unique string ID generator (used for shared links)
- `valibot` 1.3.1 - TypeScript validation library with small bundle size
- `sveltekit-rate-limiter` 0.7.0 - Rate limiting middleware for authentication endpoints
- `@types/bun` 1.3.11 - TypeScript definitions for Bun runtime
- `@types/node` 22.19.15 - Node.js type definitions for server code

## Configuration

- Configuration via environment variables prefixed with `LOGWIZ_` (e.g., `LOGWIZ_QUICKWIT_URL`, `LOGWIZ_DATABASE_PATH`)
- Example file: `.env.example` documents all available configuration options
- Auth secret: Auto-generated at `./data/.secret` if not provided via `LOGWIZ_AUTH_SECRET`
- Google OAuth: Credentials stored in database via `appSettings` table (keys: `google_client_id`, `google_client_secret`, `google_allowed_domains`)
- `svelte.config.js` - SvelteKit configuration with Bun adapter and custom origin handling patch
- `vite.config.ts` - Vite build configuration with SvelteKit and Tailwind plugins
- `vitest.config.ts` - Test runner configuration with coverage settings
- `drizzle.config.ts` - Database migration configuration for SQLite
- `tsconfig.json` - TypeScript compiler options (extends SvelteKit's generated config)
- `.prettierrc` - Formatter configuration (tabs, single quotes, 100-char line width)
- Path alias `$lib` points to `src/lib` (SvelteKit built-in)
- Configured in `svelte.config.js` and `vitest.config.ts`

## Platform Requirements

- Bun 1.0.0 or higher (enforced in `engines` field)
- Node.js-compatible environment for tooling
- Bun 1.0.0+ for runtime execution
- Quickwit instance at configured URL (required via `LOGWIZ_QUICKWIT_URL`)
- SQLite database (local file storage, no external DB required)
- Optional: Google OAuth credentials for social authentication
- Bun-compiled handler at `./build/handler.js` (custom adapter patches origin detection)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- TypeScript utilities: `camelCase.ts` (e.g., `query.ts`, `debounce.ts`, `field-resolver.ts`)
- Services: `[domain].service.ts` (e.g., `user.service.ts`, `log.service.ts`, `history.service.ts`)
- Remote API functions: `[domain].remote.ts` (e.g., `logs.remote.ts`, `auth.remote.ts`)
- Database-related: `schema.ts` for table definitions
- Svelte components: `PascalCase.svelte` (e.g., `LogRow.svelte`, `QueryInput.svelte`)
- Test files: `[filename].test.ts` colocated in `tests/` directory with matching structure
- Camel case: `escapeFilterValue()`, `formatFieldValue()`, `resolveFieldValue()`
- Hook functions prefixed with `use`: `useDebounce()`, `useSearch()` (internal state management pattern)
- Factory/builder patterns: camel case, descriptive names like `buildInviteUrl()`, `resolveTimestamps()`
- Handler functions descriptive: `_createHealthHandler()` (underscore prefix for internal test utilities)
- Service functions export async functions directly: `listUsersWithInvites()`, `createInvite()`
- Camel case throughout: `localBuffer`, `showDropdown`, `validationError`, `inputEl`
- React-style state names: `focused`, `loading`, `error`, `suggestions`
- Derived/computed values using `$derived` pattern in Svelte
- Map/Set collections with descriptive names: `inviteMap`, `googleUserIds`, `fastSet`
- Destructured props in components always explicit with type annotation
- Interface names: `PascalCase` (e.g., `Props`, `ParsedQuery`, `TracebackFormatter`)
- Type aliases: `PascalCase` (e.g., `TimeRange`, `IndexField`, `LogEntry`, `User`)
- Union discriminated types: use `type` field (e.g., `RelativeTimeRange`, `AbsoluteTimeRange`)
- Discriminated union types use `type: 'literal'` pattern
- Type imports: `import type { X } from ...`
- Schema types inferred from validators: `v.InferOutput<typeof schema>`

## Code Style

- Tool: Prettier (configured in `.prettierrc`)
- Tabs: True (uses tabs instead of spaces)
- Single quotes: True
- Trailing commas: False (`"none"`)
- Print width: 100 characters
- Svelte parser plugin enabled
- Tailwind CSS class sorting plugin enabled
- No explicit ESLint config found
- Format checking: `prettier --check .`
- Watch mode for development: `prettier --check . --watch`
- Strict mode: True
- Resolve JSON modules: True
- Force consistent casing: True
- Check JS files: True
- Source maps: Enabled for development

## Import Organization

- `$lib` - Maps to `src/lib/`
- `$app` - SvelteKit app imports
- Fully configured in `svelte.config.js` and TypeScript `jsconfig`

## Error Handling

- Errors thrown explicitly as `Error` instances with descriptive messages
- Better Auth errors caught as `APIError` type: `if (e instanceof APIError) { throw new Error(e.message) }`
- SvelteKit HTTP errors: Use `error()` function for validation failures
- Validation errors from Quickwit: `ValidationError` caught and re-thrown as HTTP 400
- Try-catch with re-throw pattern used for unexpected errors
- Service functions throw, routes handle

## Logging

- No explicit logging framework dependency detected
- Debugging via browser DevTools when needed
- Server-side errors thrown, not logged (error handling delegation to caller)

## Comments

- Inline comments used for complex parsing logic (e.g., field resolution algorithm)
- Comments mark internal helper sections: `// --- Internal helpers ---`
- Rare JSDoc usage detected
- Comments explain "why" for non-obvious decisions, e.g.: "Better Auth's admin plugin doesn't infer custom additionalFields in listUsers return type"
- Not widely used in this codebase
- When type information is clear from TypeScript, documentation omitted
- Can be added to public service functions if clarity improves

## Function Design

- Utility functions: 10-60 lines
- Service functions: 20-80 lines
- Svelte components: 50-150 lines (with template)
- Complex parsers: Up to 100+ lines (e.g., `query.ts` parser)
- Single object parameter for functions with 2+ arguments (destructuring)
- Named parameters aid readability and future extensibility
- Example: `function addClause(query: string, field: string, value: string, exclude?: boolean)`
- Functions return values directly (no wrapper objects for single returns)
- Multiple returns use discriminated unions: `{ status: 'ok' } | { status: 'error', message: string }`
- Async functions return Promises of the result type
- Nullable/optional: Use explicit `| null` or `| undefined` in types

## Module Design

- Utility modules export named functions (not default)
- Services export multiple named async functions
- Type definitions centralized in `$lib/types.ts`
- Schema validators defined alongside schemas in `$lib/schemas/`
- No wildcard re-exports detected
- Explicit exports preferred for tree-shaking

## Svelte-Specific Conventions

- Svelte 5 runes pattern: `let { prop1, prop2 }: TypeAnnotation = $props();`
- Props interface defined inline with explicit types
- Optional props with defaults: `prop = 'default' as const`
- Callback props: `onclick = () => {}`
- `$state`: Component-level mutable state
- `$derived`: Computed values from state
- `$derived.by()`: Complex computed values with custom logic
- `$effect`: Side effects, cleanup functions
- Inline arrow functions preferred: `onclick = { fn }`
- Callbacks passed as props: `onclick: () => void`
- Keyboard handling: Check `e.key` for specific keys

## Data Validation

- Schemas defined in `$lib/schemas/` with `Schema` suffix
- Pipelines for chained validators: `v.pipe(v.string(), v.minLength(1), v.trim())`
- Transform functions for type coercion: `v.transform((s): string[] | null => ...)`
- Pick lists for enums: `v.picklist(['utc', 'local'])`
- Type inference: `type SchemaInput = v.InferOutput<typeof schema>`

## Remote Functions (SvelteKit Server Functions)

- `query()` for read-only operations (field value searches)
- `command()` for mutations (search logs, write data)
- Always wrapped with validation schema
- Always call `requireUser()` middleware for auth
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- SvelteKit 5 with experimental Remote Functions (RPC-style API)
- Reactive state management using Svelte 5 runes (`$state`, `$derived`)
- Server-side services (data access layer) separate from API layer
- Database-backed configuration with SQLite via Drizzle ORM
- Quickwit integration for log search and aggregation
- Token-based authentication via Better Auth

## Layers

- Purpose: Render UI and handle user interactions
- Location: `src/routes/` (page components) and `src/lib/components/` (reusable components)
- Contains: Svelte components (`.svelte` files), page templates
- Depends on: Remote Functions (API layer), stores, utilities
- Used by: Browser/client
- Purpose: Provide type-safe, validated RPC endpoints for client consumption
- Location: `src/lib/api/*.remote.ts`
- Contains: Remote function definitions using `query`, `command`, `form` from `$app/server`
- Depends on: Schemas (Valibot validation), middleware (auth), services
- Used by: Client-side components and stores via `$app/server` imports
- Purpose: Encapsulate domain logic and data operations
- Location: `src/lib/server/services/`
- Contains: Service modules for different domains (logs, indexes, users, preferences, etc.)
- Key files:
- Depends on: Database, Quickwit client, external services
- Used by: Remote Functions
- Purpose: Persist application data and query log sources
- Location: `src/lib/server/db/` (SQLite) and `src/lib/server/quickwit.ts` (Quickwit client)
- Contains:
- Depends on: SQLite database, Quickwit API
- Used by: Services
- Purpose: Manage reactive application state on the client
- Location: `src/lib/stores/search.svelte.ts`
- Contains: Search store with reactive state for logs, fields, filters, histogram
- Depends on: Remote Functions, utilities (time, query, fields)
- Used by: Page components
- Purpose: Cross-cutting concerns (auth, security, rate limiting)
- Location: `src/hooks.server.ts` and `src/lib/middleware/`
- Contains: Authentication handler, rate limiter, security headers
- Key hooks:
- Purpose: Centralized environment and app configuration
- Location: `src/lib/server/config.ts`
- Contains: Config validation, defaults, secret generation
- Used by: Hooks and services at startup

## Data Flow

- **Server-rendered data**: Loaded via `+page.server.ts` (auth-required data) or `+page.ts` (public data)
- **Reactive state**: Managed in stores using Svelte 5 runes (`$state`, `$derived`)
- **Client-side updates**: Components directly modify store state, triggering re-renders
- **Persistence**: User preferences synced to database via remote functions on change

## Key Abstractions

- Purpose: Type-safe RPC endpoint with automatic validation
- Examples: `searchLogs`, `getIndexes`, `saveIndexConfig` in `src/lib/api/`
- Pattern: `export const functionName = query|command|form(schema, async (data) => { ... })`
- Validation: Valibot schemas in `src/lib/schemas/`
- Purpose: Encapsulate business logic for a domain
- Examples: `log.service.ts`, `index.service.ts`
- Pattern: Export multiple `async function` for domain operations
- Database: Uses Drizzle ORM for queries
- Quickwit: Uses `quickwit-js` library
- Purpose: Client reactive state container
- Example: `search.svelte.ts` exports `createSearchStore()`
- Pattern: State declared with `$state`, derived values with `$derived`
- Side effects: `$effect()` blocks handle reactive subscriptions
- Purpose: Map Quickwit index metadata to app-level settings
- Stored: `qwIndex` table with fields like `timestampField`, `levelField`, `messageField`
- Used by: Log display, filtering, aggregations
- Synchronized: `syncIndexesFromQuickwit()` called on startup and manually

## Entry Points

- Location: Built and run via `svelte-adapter-bun`
- Handler: `build/handler.js` (generated, patched in `svelte.config.js`)
- Startup: `hooks.server.ts` initializes auth, syncs indexes, seeds admin
- **`/(app)`** (`src/routes/(app)/+page.svelte`): Main log search interface
- **`/(app)/administration`** (`src/routes/(app)/administration/+page.svelte`): Admin panel
- **`/(app)/share/[code]`** (`src/routes/(app)/share/[code]/+page.svelte`): Shared log view
- **`/auth/sign-in`** (`src/routes/auth/sign-in/+page.svelte`): Login page
- **`/auth/setup`** (`src/routes/auth/setup/+page.svelte`): Initial setup
- **`/auth/change-password`** (`src/routes/auth/change-password/+page.svelte`): Force password change
- **`/api/health`** (`src/routes/api/health/+server.ts`): Health check endpoint
- Config loading: `src/lib/server/config.ts` validates environment
- Database: Drizzle ORM migrations applied (if needed)
- Index sync: `syncIndexesFromQuickwit()` populates `qwIndex` table
- Admin seed: `seedDefaultAdmin()` creates initial user

## Error Handling

- **Validation errors**: Valibot schema validation in remote functions, returns 400 on failure
- **Quickwit errors**: `rethrowValidationError()` in `log.service.ts` catches `ValidationError` and returns 400
- **Auth errors**: Middleware returns 401/403, remote functions call `requireUser()`/`requireAdmin()`
- **Database errors**: Services allow natural throw, SvelteKit converts to 500
- **Rate limit errors**: Middleware returns 429 with `Retry-After` header
- **Redirect errors**: `redirect(302, path)` in loaders for auth flow

## Cross-Cutting Concerns

- Session-based via Better Auth
- Middleware attaches user to `event.locals`
- Remote functions/services use `requireUser()` and `requireAdmin()` helpers
- Password change enforcement via middleware redirect
- Per-IP rate limiting on auth endpoints (`/auth/sign-in`, `/api/auth/sign-in`)
- Configurable via `LOGWIZ_SIGNIN_RATE_LIMIT_MAX` (default 5 per minute)
- Content-Security-Policy (nonce for scripts, unsafe-inline for styles)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-XSS-Protection: 0
- Referrer-Policy
- Permissions-Policy (camera, microphone, geolocation disabled)
- Admins can access all indexes
- Regular users can only access indexes with `visibility: 'all'`
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
