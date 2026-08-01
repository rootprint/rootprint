import { AggregationBuilder } from 'quickwit-js';
import type { AggregationBucket, BucketAggregationResult } from 'quickwit-js';

export function termsAgg(field: string, size: number) {
	return AggregationBuilder.terms(field, { size, shardSize: size });
}

/** Quickwit returns buckets as an array, or as an object when the aggregation is `keyed`. */
export function asBuckets(agg: BucketAggregationResult | undefined): AggregationBucket[] {
	const buckets = agg?.buckets;
	if (buckets === undefined) return [];
	return Array.isArray(buckets) ? buckets : Object.values(buckets);
}
