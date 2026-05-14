export const SEVERITY_ORDER = [
	'trace',
	'debug',
	'info',
	'warn',
	'warning',
	'error',
	'critical',
	'fatal'
] as const;

export const LEVEL_TOKEN_MAP: Record<string, string> = {
	warn: 'warning',
	fatal: 'critical',
	trace: 'debug'
};
