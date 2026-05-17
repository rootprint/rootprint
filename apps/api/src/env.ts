import type { Session } from './lib/auth.js';
import type { VerifiedIngestToken } from './services/ingest-token.service.js';

export type AppEnv = {
	Variables: {
		requestId: string;
		session?: Session;
		token?: VerifiedIngestToken;
	};
};

export type AuthedEnv = {
	Variables: AppEnv['Variables'] & { session: NonNullable<Session> };
};
