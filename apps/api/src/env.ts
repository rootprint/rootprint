import type { Session } from './lib/auth.js';
import type { VerifiedApiKey } from './types.js';

export type AppEnv = {
	Variables: {
		requestId: string;
		session?: Session;
		apiKey?: VerifiedApiKey;
	};
};

export type AuthedEnv = {
	Variables: AppEnv['Variables'] & { session: NonNullable<Session> };
};
