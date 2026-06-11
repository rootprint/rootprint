import { SEVERITY_ORDER } from '$lib/constants/severity';

const SEVERITY_ORDER_INDEX = new Map<string, number>(SEVERITY_ORDER.map((v, i) => [v, i]));

export function sortBySeverity(values: string[]): string[] {
	return values.toSorted((a, b) => {
		const ai = SEVERITY_ORDER_INDEX.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
		const bi = SEVERITY_ORDER_INDEX.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
		return ai - bi;
	});
}
