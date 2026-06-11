export const DEP = {
	session: 'app:session',
	apiKeys: 'app:api-keys',
	personalKeys: 'app:personal-keys',
	authentication: 'app:authentication',
	authenticationGoogle: 'app:authentication-google',
	authenticationGithub: 'app:authentication-github',
	indexes: 'app:indexes',
	index: (id: string): `app:index:${string}` => `app:index:${id}`,
	users: 'app:users',
	activity: 'app:activity',
	activityUser: 'app:activity:user',
	activityApiKey: 'app:activity:api-key',
	sendLogsApiKeys: 'send-logs:api-keys'
} as const;
