import { SEVERITY_ORDER } from '$lib/constants/severity';

const SEVERITY_ORDER_INDEX = new Map<string, number>(SEVERITY_ORDER.map((v, i) => [v, i]));

/** Unknown values sort to the end, preserving their input order. */
export function sortBySeverity(values: string[]): string[] {
	return values.toSorted((a, b) => {
		const ai = SEVERITY_ORDER_INDEX.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
		const bi = SEVERITY_ORDER_INDEX.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
		return ai - bi;
	});
}

/** uPlot needs a concrete CSS color string, not a `var(--...)`. */
export function baseContentAt(alpha: number): string {
	if (typeof document === 'undefined') return '';
	const v =
		getComputedStyle(document.documentElement).getPropertyValue('--color-base-content').trim() ||
		'#0a0a0a';
	return `color-mix(in oklab, ${v} ${Math.round(alpha * 100)}%, transparent)`;
}
