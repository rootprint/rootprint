export function formatCountAsPercent(count: number | null, total: number): string {
	if (count === null || total <= 0) return '—';
	if (count === 0) return '0%';
	const ratio = count / total;
	if (ratio < 0.005) return '<1%';
	return `~${Math.round(ratio * 100)}%`;
}
