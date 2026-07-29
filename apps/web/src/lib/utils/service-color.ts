/** Must match the number of `--trace-service-*` custom properties declared in app.css. */
const PALETTE_SIZE = 8;

export function serviceColor(serviceName: string): string {
	let hash = 2166136261;
	for (let i = 0; i < serviceName.length; i++) {
		hash ^= serviceName.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return `var(--trace-service-${((hash >>> 0) % PALETTE_SIZE) + 1})`;
}
