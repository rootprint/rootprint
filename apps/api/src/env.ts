import type { Session } from './lib/auth.js';
import type { VerifiedIngestToken, VerifiedSearchToken } from './types.js';

export type AppEnv = {
	Variables: {
		requestId: string;
		session?: Session;
		ingestToken?: VerifiedIngestToken;
		searchToken?: VerifiedSearchToken;
	};
};

export type AuthedEnv = {
	Variables: AppEnv['Variables'] & { session: NonNullable<Session> };
};
