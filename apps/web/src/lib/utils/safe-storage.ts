// Thin wrappers around localStorage that swallow access errors (private
// mode, disabled storage, sandboxed iframes) and JSON parse failures.

export function readString(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeString(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {}
}

export function removeKey(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {}
}

export function readJSON<T>(key: string, fallback: T): T {
	const raw = readString(key);
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function writeJSON(key: string, value: unknown): void {
	try {
		writeString(key, JSON.stringify(value));
	} catch {
		// no-op (JSON cycles, etc.)
	}
}
