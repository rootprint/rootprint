export const STATS_LABELS = {
	lastIngest: 'Last ingest',
	ingestion24h: 'Ingestion · 24h',
	size: 'Index size',
	growth7d: 'Growth · 7d avg'
} as const;

export const STATS_LABELS_ORDERED = [
	STATS_LABELS.lastIngest,
	STATS_LABELS.ingestion24h,
	STATS_LABELS.size,
	STATS_LABELS.growth7d
] as const;
