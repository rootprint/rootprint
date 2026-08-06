import type { IntegrationOrigin } from './types';

export type OriginMeta = {
	id: IntegrationOrigin;
	label: string;
};

/** Wizard sections, in display order. */
export const ORIGINS: OriginMeta[] = [
	{ id: 'Application', label: 'Application code' },
	{ id: 'Containers', label: 'Containers' },
	{ id: 'OpenTelemetry', label: 'OpenTelemetry' },
	{ id: 'LogAgents', label: 'Log Agents' },
	{ id: 'WebServers', label: 'Web Servers' }
];
