import type { FieldConfig } from '#lib/types.js';

export const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Also true under an unfilterable json parent. */
export function isUnfilterable(path: string, config: FieldConfig): boolean {
	return config.unfilterableFields.some((f) => path === f || path.startsWith(`${f}.`));
}
