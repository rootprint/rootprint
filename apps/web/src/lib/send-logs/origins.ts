import { Cable, Globe, Container, Code, Cloud, Waypoints } from 'lucide-svelte';
import type { IconComponent, IntegrationOrigin } from './types';

export type OriginMeta = {
	id: IntegrationOrigin;
	label: string;
	icon: IconComponent;
};

/** Wizard sections, in display order. */
export const ORIGINS: OriginMeta[] = [
	{ id: 'Application', label: 'Application code', icon: Code },
	{ id: 'Containers', label: 'Containers', icon: Container },
	{ id: 'OpenTelemetry', label: 'OpenTelemetry', icon: Waypoints },
	{ id: 'LogAgents', label: 'Log Agents', icon: Cable },
	{ id: 'WebServers', label: 'Web Servers', icon: Globe },
	{ id: 'Cloud', label: 'Cloud provider', icon: Cloud }
];
