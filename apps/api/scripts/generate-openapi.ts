import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app } from '../src/app.js';
import { authOpenAPISchema } from '../src/lib/auth.js';
import { buildSpec } from '../src/lib/openapi/spec.js';

// Deterministic serialization: sort object keys recursively for stable diffs.
function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.toSorted()
				.map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
		);
	}
	return value;
}

const spec = await buildSpec(app);

const authSpec = await authOpenAPISchema();
const authPaths = Object.fromEntries(
	Object.entries(authSpec.paths).map(([p, item]) => [`/api/auth${p}`, item])
);

const merged = {
	...spec,
	paths: { ...spec.paths, ...authPaths },
	components: {
		...spec.components,
		securitySchemes: {
			...spec.components?.securitySchemes,
			...authSpec.components.securitySchemes
		},
		schemas: {
			...spec.components?.schemas,
			...authSpec.components.schemas
		}
	}
};

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../openapi.json');
writeFileSync(out, `${JSON.stringify(sortKeys(merged), null, '\t')}\n`);
console.log(`Wrote ${out}`);
