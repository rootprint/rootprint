import type { IntegrationOrigin } from './types';

export type OriginMeta = {
	id: IntegrationOrigin;
	label: string;
};

/** Wizard sections, in display order. */
export const ORIGINS: OriginMeta[] = [
	{ id: 'Application', label: 'Application code' },
	{ id: 'Agents', label: 'Collectors and agents' },
	{ id: 'Infrastructure', label: 'Infrastructure' }
];
