import type { Session } from 'better-auth/minimal';
import type { auth } from '$lib/server/auth';

type Auth = typeof auth;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: Auth['$Infer']['Session']['user'];
			session?: Session;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
