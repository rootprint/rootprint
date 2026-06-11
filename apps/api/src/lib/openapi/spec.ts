import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateSpecs } from 'hono-openapi';
import type { GenerateSpecOptions } from 'hono-openapi';
import type { Hono } from 'hono';

import { errorResponseComponents } from './errors.js';

function rootVersion(): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const pkgPath = path.resolve(here, '../../../../../package.json');
	return JSON.parse(readFileSync(pkgPath, 'utf8')).version as string;
}

export const documentation: GenerateSpecOptions['documentation'] = {
	openapi: '3.1.0',
	info: {
		title: 'Rootprint API',
		version: rootVersion(),
		description: 'HTTP API for the Rootprint log management platform.'
	},
	servers: [{ url: '/', description: 'Same-origin API' }],
	components: {
		securitySchemes: {
			cookieAuth: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
			ingestBearer: { type: 'http', scheme: 'bearer', description: 'Ingest API key' },
			personalBearer: { type: 'http', scheme: 'bearer', description: 'Personal API key' }
		},
		responses: errorResponseComponents
	},
	security: [{ cookieAuth: [] }]
};

// Single source of truth so the live /api/openapi.json and the generated file match.
export const specOptions = {
	documentation,
	excludeStaticFile: true,
	excludeMethods: ['OPTIONS', 'HEAD'],
	// Keep only the documented API surface; drop the SPA catch-all and asset routes.
	exclude: [/^\/(?!api\/|v1\/).*/]
} satisfies Partial<GenerateSpecOptions>;

export async function buildSpec(app: Hono) {
	return generateSpecs(app, specOptions);
}
