import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.LOGWIZ_DATABASE_PATH ?? './data/logwiz.db' },
	verbose: true,
	strict: true
});
