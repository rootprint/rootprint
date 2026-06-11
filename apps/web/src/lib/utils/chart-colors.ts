export const CANVAS_FALLBACK_COLOR = '#0a0a0a';

export function baseContentAt(alpha: number): string {
	if (typeof document === 'undefined') return '';
	const v =
		getComputedStyle(document.documentElement).getPropertyValue('--color-base-content').trim() ||
		CANVAS_FALLBACK_COLOR;
	return `color-mix(in oklab, ${v} ${Math.round(alpha * 100)}%, transparent)`;
}

export function cssVarColor(value: string): string {
	if (typeof document === 'undefined') return value;
	const probe = document.createElement('span');
	probe.style.color = value;
	probe.style.position = 'absolute';
	probe.style.opacity = '0';
	probe.style.pointerEvents = 'none';
	document.body.appendChild(probe);
	const resolved = getComputedStyle(probe).color;
	probe.remove();
	return resolved || value;
}
