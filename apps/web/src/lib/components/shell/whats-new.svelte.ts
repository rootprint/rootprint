import { readString, writeString } from '$lib/utils/safe-storage';

const STORAGE_KEY = 'rootprint:seen-version';

export const { version, highlights } = WHATS_NEW;

// The sidebar card and Help → What's new open the same dialog, which HelpMenu renders.
export const whatsNew = $state({ open: false, seen: readString(STORAGE_KEY) === version });

export function dismissWhatsNew() {
	whatsNew.seen = true;
	writeString(STORAGE_KEY, version);
}

export function openWhatsNew() {
	whatsNew.open = true;
	dismissWhatsNew();
}
