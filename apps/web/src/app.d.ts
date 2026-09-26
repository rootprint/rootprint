// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			openHit?: Record<string, unknown>;
		}
		// interface Platform {}
	}

	// Injected by vite.config.ts from CHANGELOG.md.
	const WHATS_NEW: { version: string; highlights: string[] };
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
