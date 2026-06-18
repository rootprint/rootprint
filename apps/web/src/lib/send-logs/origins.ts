import { Boxes, Server, Container, Code, Cloud, Waypoints } from 'lucide-svelte';
import type { IconComponent, IntegrationOrigin } from './types';

export type OriginMeta = {
	id: IntegrationOrigin;
	label: string;
	icon: IconComponent;
};

/** Router buckets, in coverage-first display order. */
export const ORIGINS: OriginMeta[] = [
	{ id: 'OpenTelemetry', label: 'OpenTelemetry', icon: Waypoints },
	{ id: 'Kubernetes', label: 'Kubernetes cluster', icon: Boxes },
	{ id: 'Host', label: 'Host / VM fleet', icon: Server },
	{ id: 'Containers', label: 'Containers', icon: Container },
	{ id: 'Application', label: 'Application code', icon: Code },
	{ id: 'Cloud', label: 'Cloud provider', icon: Cloud }
];
