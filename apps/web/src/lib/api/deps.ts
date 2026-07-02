export const DEP = {
	session: 'app:session',
	apiKeys: 'app:api-keys',
	personalKeys: 'app:personal-keys',
	serviceAccountSettings: 'app:service-account-settings',
	indexes: 'app:indexes',
	index: (id: string): `app:index:${string}` => `app:index:${id}`,
	users: 'app:users',
	sendLogsApiKeys: 'send-logs:api-keys'
} as const;
