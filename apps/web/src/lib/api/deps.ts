export const DEP = {
	session: 'app:session',
	apiKeys: 'app:api-keys',
	personalKeys: 'app:personal-keys',
	serviceAccountSettings: 'app:service-account-settings',
	indexes: 'app:indexes',
	index: (id: string): `app:index:${string}` => `app:index:${id}`,
	users: 'app:users',
	traceExplore: 'app:trace-explore',
	sendTelemetryApiKeys: 'send-telemetry:api-keys'
} as const;
