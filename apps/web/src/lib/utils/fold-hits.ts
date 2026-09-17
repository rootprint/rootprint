import type { LogHit } from '$lib/types';
import { formatCell } from './column-width';
import { getByPath } from './get-by-path';

export type FoldSummaryRow = {
	kind: 'fold';
	id: string;
	hit: LogHit;
	count: number;
	expanded: boolean;
};

export type LogListRow = { kind: 'hit'; hit: LogHit; foldChild?: boolean } | FoldSummaryRow;

// Level is always visible via the color bar, so it counts even when it isn't a column.
export function foldKey(
	hit: LogHit,
	columns: readonly string[],
	timestampField: string | undefined
): string {
	const parts = [hit.level];
	for (const column of columns) {
		if (timestampField !== undefined && column === timestampField) continue;
		parts.push(`${column}:${formatCell(getByPath(hit.raw, column))}`);
	}
	return JSON.stringify(parts);
}

export function groupConsecutiveHits(
	hits: readonly LogHit[],
	columns: readonly string[],
	timestampField: string | undefined
): LogHit[][] {
	const runs: LogHit[][] = [];
	let run: LogHit[] = [];
	let runKey: string | null = null;
	for (const hit of hits) {
		const key = foldKey(hit, columns, timestampField);
		if (key !== runKey) {
			run = [];
			runs.push(run);
			runKey = key;
		}
		run.push(hit);
	}
	return runs;
}

export function foldRuns(
	runs: readonly (readonly LogHit[])[],
	expanded: ReadonlySet<string>
): LogListRow[] {
	const rows: LogListRow[] = [];
	for (const run of runs) {
		const first = run[0];
		if (first === undefined) continue;
		if (run.length === 1) {
			rows.push({ kind: 'hit', hit: first });
			continue;
		}
		const isExpanded = expanded.has(first.key);
		rows.push({ kind: 'fold', id: first.key, hit: first, count: run.length, expanded: isExpanded });
		if (isExpanded) {
			for (let i = 1; i < run.length; i++)
				rows.push({ kind: 'hit', hit: run[i]!, foldChild: true });
		}
	}
	return rows;
}
