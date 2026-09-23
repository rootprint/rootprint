import { AggregationBuilder } from 'quickwit-js';
import type {
	AggregationBucket,
	BucketAggregationResult,
	PercentilesAggregationResult
} from 'quickwit-js';

export function termsAgg(field: string, size: number) {
	return AggregationBuilder.terms(field, { size, shardSize: size });
}

/** Quickwit returns buckets as an array, or as an object when the aggregation is `keyed`. */
export function asBuckets(agg: BucketAggregationResult | undefined): AggregationBucket[] {
	const buckets = agg?.buckets;
	if (buckets === undefined) return [];
	return Array.isArray(buckets) ? buckets : Object.values(buckets);
}

export const P50 = '50.0';
export const P95 = '95.0';
export const P99 = '99.0';

const finite = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Reads the bucket's `pct` percentiles sub-aggregation. */
export const percentile = (bucket: AggregationBucket, percent: string): number | null =>
	finite((bucket['pct'] as { values?: Record<string, unknown> } | undefined)?.values?.[percent]);

export const summaryPercentile = (
	result: PercentilesAggregationResult | undefined,
	percent: string
): number | null => {
	const values = result?.values;
	if (values === undefined || Array.isArray(values)) return null;
	return finite(values[percent]);
};

export const metric = (bucket: AggregationBucket, name: string): number | null =>
	finite((bucket[name] as { value?: unknown } | undefined)?.value);
