const PALETTE_SIZE = 10;

export function serviceColorAt(index: number): string {
	return `var(--trace-service-${(index % PALETTE_SIZE) + 1})`;
}

export function serviceColor(serviceName: string): string {
	let hash = 2166136261;
	for (let i = 0; i < serviceName.length; i++) {
		hash ^= serviceName.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return serviceColorAt(hash >>> 0);
}
