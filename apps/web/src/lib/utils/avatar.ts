export function avatarInitials(name: string | null | undefined): string {
	if (!name) return '?';
	const trimmed = name.trim();
	if (trimmed === '') return '?';
	const parts = trimmed.split(/\s+/);
	const first = parts[0][0] ?? '?';
	const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
	return (first + last).toUpperCase();
}

export function avatarColor(seed: string): string {
	let h = 5381;
	// Iterate by code point (non-BMP safety); `| 0` is the int32 wraparound DJB2 needs, not float truncation.
	for (const ch of seed) h = ((h << 5) + h + (ch.codePointAt(0) ?? 0)) | 0;
	const hue = Math.abs(h) % 360;
	const hue2 = (hue + 40) % 360;
	return `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${hue2}, 70%, 45%))`;
}
