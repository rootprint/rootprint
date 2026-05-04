export function formatCompactNumber(n: number | null): string {
	if (n == null) return '—';
	return new Intl.NumberFormat('en', {
		notation: 'compact',
		maximumFractionDigits: 2
	}).format(n);
}

export function formatCountLabel(
	filtered: number,
	total: number,
	singular: string,
	plural: string,
	isFiltered: boolean
): string {
	if (isFiltered) return `${filtered} of ${total}`;
	return `${total} ${total === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}
