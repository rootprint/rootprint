import type { LogField } from '$lib/types';
import { isOtelAttr, isOtelResourceAttr } from './fields';

export type SectionKey = 'pinned' | 'top' | 'attributes' | 'resource_attributes';

export type RankedField = { field: LogField; label: string; count: number };
export type FieldSection = { key: SectionKey; label: string; fields: RankedField[] };

export type BuildFieldSectionsInput = {
	fields: readonly LogField[];
	/** Field path -> how many of the sampled hits carry it. */
	counts: ReadonlyMap<string, number>;
	pinned: ReadonlySet<string>;
	/** Live columns and filter targets; a deliberate selection always earns a row. */
	inUse: ReadonlySet<string>;
	/** Expanded rows; an open field keeps its row even once the sample stops seeing it. */
	open: ReadonlySet<string>;
	isOtel: boolean;
	/** Already trimmed and lowercased. Empty means the idle list. */
	search: string;
};

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

// ponytail: a dotted name is taken to be a json leaf — worth a row only once the data shows it.
// Every otel-declared column is undotted; a schema with dotted columns needs a flag on IndexField.
const isDeclaredColumn = (name: string) => !name.includes('.');

/**
 * The panel's sections, ranked by how much of the sampled page carries each field. Idle, the list
 * is the declared columns plus what the sample saw; typing searches the whole inventory, which is
 * thousands of json leaves per range.
 */
export function buildFieldSections(input: BuildFieldSectionsInput): FieldSection[] {
	const { fields, counts, pinned, inUse, open, isOtel, search } = input;

	const sections: Record<SectionKey, RankedField[]> = {
		pinned: [],
		top: [],
		attributes: [],
		resource_attributes: []
	};

	for (const field of fields) {
		const count = counts.get(field.name) ?? 0;
		if (search === '') {
			const earnsRow =
				count > 0 ||
				isDeclaredColumn(field.name) ||
				pinned.has(field.name) ||
				inUse.has(field.name) ||
				open.has(field.name);
			if (!earnsRow) continue;
		} else if (
			!field.name.toLowerCase().includes(search) &&
			!field.displayName.toLowerCase().includes(search)
		) {
			continue;
		}

		const key: SectionKey = pinned.has(field.name)
			? 'pinned'
			: isOtel && isOtelResourceAttr(field.name)
				? 'resource_attributes'
				: isOtel && isOtelAttr(field.name)
					? 'attributes'
					: 'top';
		// Pinned rows carry the full path: it is the one section that mixes prefixes.
		sections[key].push({ field, label: key === 'pinned' ? field.name : field.displayName, count });
	}

	// Count first, so the fields this search actually has float to the top of every section.
	const rank = (a: RankedField, b: RankedField) =>
		b.count - a.count ||
		collator.compare(a.label, b.label) ||
		a.field.name.localeCompare(b.field.name);

	return [
		{ key: 'pinned', label: 'Pinned', fields: sections.pinned.toSorted(rank) },
		{ key: 'top', label: '', fields: sections.top.toSorted(rank) },
		{ key: 'attributes', label: 'Attributes', fields: sections.attributes.toSorted(rank) },
		{
			key: 'resource_attributes',
			label: 'Resource Attributes',
			fields: sections.resource_attributes.toSorted(rank)
		}
	];
}
