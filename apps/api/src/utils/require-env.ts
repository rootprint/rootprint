function assertValidUrl(name: string, value: string): void {
	if (!URL.canParse(value)) {
		throw new Error(`Environment variable ${name} is not a valid URL: ${value}`);
	}
	const protocol = new URL(value).protocol;
	if (protocol !== 'http:' && protocol !== 'https:') {
		throw new Error(
			`Environment variable ${name} must use http:// or https:// (got ${protocol}//): ${value}`
		);
	}
}

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value.trim() === '') {
		throw new Error(
			`Missing required environment variable: ${name}. Set it in .env at the repo root or your container environment.`
		);
	}
	return value;
}

export function requireUrlEnv(name: string): string {
	const value = requireEnv(name);
	assertValidUrl(name, value);
	return value;
}

export function optionalUrlEnv(name: string): string | null {
	const value = process.env[name];
	if (value === undefined || value.trim() === '') return null;
	assertValidUrl(name, value);
	return value;
}

export function intEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw.trim() === '') return fallback;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) {
		throw new Error(`Environment variable ${name} is not a valid integer: ${raw}`);
	}
	return parsed;
}
