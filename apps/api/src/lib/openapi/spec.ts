import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateSpecs } from 'hono-openapi';
import type { GenerateSpecOptions } from 'hono-openapi';
import type { Env, Hono } from 'hono';
import type { Schema } from 'hono/types';

import { authOpenAPISchema } from '../auth.js';
import { decorateAuthPaths } from './auth-descriptions.js';
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
	servers: [{ url: 'https://example.com', description: 'Rootprint API' }],
	components: {
		securitySchemes: {
			cookieAuth: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
			ingestBearer: { type: 'http', scheme: 'bearer', description: 'Ingest API key' },
			personalBearer: {
				type: 'http',
				scheme: 'bearer',
				description: 'Query API key (personal or service account)'
			}
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

type PathItemObject = Record<string, unknown>;

function prefixedAuthPaths(paths: Record<string, PathItemObject>): Record<string, PathItemObject> {
	return Object.fromEntries(Object.entries(paths).map(([p, item]) => [`/api/auth${p}`, item]));
}

export async function buildSpec<E extends Env, S extends Schema, P extends string>(
	app: Hono<E, S, P>
) {
	const [spec, authSpec] = await Promise.all([
		generateSpecs(app, specOptions),
		authOpenAPISchema()
	]);
	const authPaths = decorateAuthPaths(
		prefixedAuthPaths(authSpec.paths as Record<string, PathItemObject>)
	);

	return {
		...spec,
		paths: { ...spec.paths, ...authPaths },
		components: {
			...spec.components,
			securitySchemes: {
				...spec.components?.securitySchemes,
				...authSpec.components?.securitySchemes
			},
			schemas: {
				...spec.components?.schemas,
				...authSpec.components?.schemas
			}
		}
	};
}
