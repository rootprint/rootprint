import { browser } from '$app/environment';
import { storageKeys } from '$lib/constants/storage-keys';
import type { ActiveViewRef } from '$lib/types';

type StoredMap = Record<string, ActiveViewRef>;

function readMap(): StoredMap {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(storageKeys.activeView);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as StoredMap;
		}
		return {};
	} catch {
		return {};
	}
}

export function readActiveView(indexId: string): ActiveViewRef | null {
	const map = readMap();
	return map[indexId] ?? null;
}

export function writeActiveView(indexId: string, ref: ActiveViewRef | null): void {
	if (!browser) return;
	try {
		const raw = localStorage.getItem(storageKeys.activeView);
		const parsed = raw ? JSON.parse(raw) : null;
		const map: StoredMap =
			parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as StoredMap) : {};
		if (ref === null) Reflect.deleteProperty(map, indexId);
		else map[indexId] = ref;
		localStorage.setItem(storageKeys.activeView, JSON.stringify(map));
	} catch {
		// localStorage full or disabled — silently ignore
	}
}
