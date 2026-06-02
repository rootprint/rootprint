import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app } from '../src/app.js';
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
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../openapi.json');
writeFileSync(out, `${JSON.stringify(sortKeys(spec), null, '\t')}\n`);
console.log(`Wrote ${out}`);
