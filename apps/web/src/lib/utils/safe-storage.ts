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

export function readStringArray(key: string): string[] {
	const raw = readString(key);
	if (raw === null) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((v): v is string => typeof v === 'string');
	} catch {
		return [];
	}
}

export function writeJSON(key: string, value: unknown): void {
	try {
		writeString(key, JSON.stringify(value));
	} catch {
		// no-op (JSON cycles, etc.)
	}
}
