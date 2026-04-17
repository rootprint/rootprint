export function avatarInitials(name: string | null | undefined): string {
	if (!name) return '?';
	const trimmed = name.trim();
	if (trimmed === '') return '?';
	const parts = trimmed.split(/\s+/);
	const first = parts[0][0] ?? '?';
	const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
	return (first + last).toUpperCase();
}

export function avatarColor(seed: string): string {
	let h = 5381;
	for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
	const hue = Math.abs(h) % 360;
	const hue2 = (hue + 40) % 360;
	return `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${hue2}, 70%, 45%))`;
}
