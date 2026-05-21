import { config } from '../config.js';
import { serviceUnavailable } from './http-error.js';

export type PromSample = {
	labels: Record<string, string>;
	value: number;
};

export type PromMetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped';

export type PromMetric = {
	name: string;
	type: PromMetricType;
	help?: string;
	samples: PromSample[];
};

const KNOWN_TYPES: ReadonlySet<PromMetricType> = new Set([
	'counter',
	'gauge',
	'histogram',
	'summary',
	'untyped'
]);

function parseValue(raw: string): number {
	const trimmed = raw.trim();
	if (trimmed === 'NaN') return Number.NaN;
	if (trimmed === '+Inf' || trimmed === 'Inf') return Number.POSITIVE_INFINITY;
	if (trimmed === '-Inf') return Number.NEGATIVE_INFINITY;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : Number.NaN;
}

// Parse a labels block: `key="value",key2="v\"alue"`
// Returns an empty record for the no-labels case. Caller passes the inside
// of the braces (the braces themselves are already stripped).
function parseLabels(inside: string): Record<string, string> {
	const out: Record<string, string> = {};
	let i = 0;
	while (i < inside.length) {
		// Skip whitespace / commas between pairs.
		while (i < inside.length && (inside[i] === ',' || inside[i] === ' ' || inside[i] === '\t')) i++;
		if (i >= inside.length) break;

		// Read key up to '='.
		const keyStart = i;
		while (i < inside.length && inside[i] !== '=') i++;
		const key = inside.slice(keyStart, i).trim();
		if (i >= inside.length || inside[i] !== '=') break;
		i++; // consume '='

		if (inside[i] !== '"') break;
		i++; // consume opening quote

		// Read value, honoring \" \\ \n escapes.
		let value = '';
		while (i < inside.length && inside[i] !== '"') {
			if (inside[i] === '\\' && i + 1 < inside.length) {
				const next = inside[i + 1];
				if (next === '"') value += '"';
				else if (next === '\\') value += '\\';
				else if (next === 'n') value += '\n';
				else value += next;
				i += 2;
			} else {
				value += inside[i];
				i++;
			}
		}
		if (inside[i] !== '"') break;
		i++; // consume closing quote

		if (key) out[key] = value;
	}
	return out;
}

// Split `<name>{labels} <value>` (labels optional) into parts. Returns null
// when the line cannot be parsed.
function parseSampleLine(line: string): { name: string; labels: Record<string, string>; value: number } | null {
	const braceStart = line.indexOf('{');
	let name: string;
	let labels: Record<string, string>;
	let rest: string;

	if (braceStart === -1) {
		// No labels — name is everything up to the first space.
		const space = line.indexOf(' ');
		if (space === -1) return null;
		name = line.slice(0, space).trim();
		labels = {};
		rest = line.slice(space + 1);
	} else {
		name = line.slice(0, braceStart).trim();
		// Assumes label values do not contain an unescaped '}'. True for all
		// known Quickwit metric output; a full quote-aware scan would be
		// needed if a future scrape target violated that.
		const braceEnd = line.lastIndexOf('}');
		if (braceEnd === -1 || braceEnd < braceStart) return null;
		labels = parseLabels(line.slice(braceStart + 1, braceEnd));
		rest = line.slice(braceEnd + 1).trim();
	}

	// `rest` is `<value> [<timestamp>]` — we ignore the timestamp.
	const valueRaw = rest.split(/\s+/)[0] ?? '';
	if (!name || !valueRaw) return null;
	return { name, labels, value: parseValue(valueRaw) };
}

export function parsePromText(text: string): PromMetric[] {
	const byName = new Map<string, PromMetric>();

	const ensure = (name: string): PromMetric => {
		let m = byName.get(name);
		if (!m) {
			m = { name, type: 'untyped', samples: [] };
			byName.set(name, m);
		}
		return m;
	};

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (line.length === 0) continue;

		if (line.startsWith('#')) {
			// Comment or HELP/TYPE header.
			const body = line.slice(1).trim();
			if (body.startsWith('HELP ')) {
				const rest = body.slice('HELP '.length);
				const space = rest.indexOf(' ');
				if (space === -1) continue;
				const name = rest.slice(0, space).trim();
				const help = rest.slice(space + 1).trim();
				ensure(name).help = help;
			} else if (body.startsWith('TYPE ')) {
				const rest = body.slice('TYPE '.length);
				const space = rest.indexOf(' ');
				if (space === -1) continue;
				const name = rest.slice(0, space).trim();
				const typeRaw = rest.slice(space + 1).trim();
				const type: PromMetricType = KNOWN_TYPES.has(typeRaw as PromMetricType)
					? (typeRaw as PromMetricType)
					: 'untyped';
				ensure(name).type = type;
			}
			continue;
		}

		const parsed = parseSampleLine(line);
		if (!parsed) continue;
		// Histogram/summary sub-series share a base name with `_bucket`, `_sum`,
		// `_count` suffixes. We keep them under their literal series name, which
		// is what the projection layer expects.
		ensure(parsed.name).samples.push({ labels: parsed.labels, value: parsed.value });
	}

	return Array.from(byName.values());
}

const METRICS_PATH = '/metrics';
const FETCH_TIMEOUT_MS = 5000;

export async function fetchQuickwitMetrics(): Promise<{ raw: string; metrics: PromMetric[] }> {
	const url = new URL(METRICS_PATH, config.quickwitUrl).toString();
	let res: Response;
	try {
		res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	} catch {
		throw serviceUnavailable(
			`Quickwit /metrics unreachable at ${url}`,
			'QUICKWIT_METRICS_UNAVAILABLE'
		);
	}
	if (!res.ok) {
		throw serviceUnavailable(
			`Quickwit /metrics returned HTTP ${res.status}`,
			'QUICKWIT_METRICS_UNAVAILABLE'
		);
	}
	let raw: string;
	try {
		raw = await res.text();
	} catch {
		throw serviceUnavailable(
			`Quickwit /metrics body unreadable at ${url}`,
			'QUICKWIT_METRICS_UNAVAILABLE'
		);
	}
	const metrics = parsePromText(raw);
	return { raw, metrics };
}
