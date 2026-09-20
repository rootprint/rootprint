import pg from 'pg';

/** The suffix is the only thing standing between a mistyped URL and a real database. */
function assertTestDatabase(databaseUrl: string): void {
	if (!/_test$/.test(new URL(databaseUrl).pathname)) {
		throw new Error(`refusing to use ${databaseUrl}: database name must end in _test`);
	}
}

async function withClient<T>(
	connectionString: string,
	fn: (client: pg.Client) => Promise<T>
): Promise<T> {
	const client = new pg.Client({ connectionString });
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}

export async function ensureDatabase(databaseUrl: string): Promise<void> {
	assertTestDatabase(databaseUrl);
	const url = new URL(databaseUrl);
	const name = url.pathname.slice(1);
	url.pathname = '/postgres';
	await withClient(url.toString(), async (client) => {
		const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
		if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
	});
}

const truncateStatements = new Map<string, string>();

/** Drizzle keeps its migrations table in the `drizzle` schema, so everything in `public` is app data. */
export async function truncateAll(databaseUrl: string): Promise<void> {
	assertTestDatabase(databaseUrl);
	await withClient(databaseUrl, async (client) => {
		// The table set is fixed once migrations have run, so this runs once per suite, not per test.
		let statement = truncateStatements.get(databaseUrl);
		if (!statement) {
			const { rows } = await client.query<{ tablename: string }>(
				`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
			);
			if (rows.length === 0) return;
			const list = rows.map((r) => `"${r.tablename}"`).join(', ');
			statement = `TRUNCATE ${list} RESTART IDENTITY CASCADE`;
			truncateStatements.set(databaseUrl, statement);
		}
		await client.query(statement);
	});
}
