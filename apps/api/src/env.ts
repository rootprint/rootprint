import type { VerifiedApiKey } from './types.js';

export type RequestSession = { user: { id: string; role?: string | null } };

export type AppEnv = {
	Variables: {
		requestId: string;
		session?: RequestSession;
		apiKey?: VerifiedApiKey;
		apiKeyActor?: { keyId: string };
	};
};

export type AuthedEnv = {
	Variables: AppEnv['Variables'] & { session: RequestSession };
};

export type KeyedEnv = {
	Variables: AppEnv['Variables'] & { apiKey: VerifiedApiKey };
};
