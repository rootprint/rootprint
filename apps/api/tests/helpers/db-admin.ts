import pg from 'pg';

export async function ensureDatabase(databaseUrl: string): Promise<void> {
	const url = new URL(databaseUrl);
	const name = url.pathname.slice(1);
	url.pathname = '/postgres';
	const client = new pg.Client({ connectionString: url.toString() });
	await client.connect();
	try {
		const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
		if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
	} finally {
		await client.end();
	}
}

/** Drizzle keeps its migrations table in the `drizzle` schema, so everything in `public` is app data. */
export async function truncateAll(databaseUrl: string): Promise<void> {
	if (!/_(test|e2e)$/.test(new URL(databaseUrl).pathname)) {
		throw new Error(`refusing to truncate ${databaseUrl}: database name must end in _test or _e2e`);
	}
	const client = new pg.Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		const { rows } = await client.query<{ tablename: string }>(
			`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
		);
		if (rows.length === 0) return;
		const list = rows.map((r) => `"${r.tablename}"`).join(', ');
		await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
	} finally {
		await client.end();
	}
}
