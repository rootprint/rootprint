import { Boxes, Server, Container, Code, Cloud, Waypoints } from 'lucide-svelte';
import type { IconComponent, IntegrationOrigin } from './types';

export type OriginMeta = {
	id: IntegrationOrigin;
	label: string;
	description: string;
	icon: IconComponent;
};

/** Router buckets, in coverage-first display order. */
export const ORIGINS: OriginMeta[] = [
	{
		id: 'OpenTelemetry',
		label: 'OpenTelemetry',
		description: 'Deploy the Collector once, then point every source at it.',
		icon: Waypoints
	},
	{
		id: 'Kubernetes',
		label: 'Kubernetes cluster',
		description: 'Ship logs from every pod in a cluster at once.',
		icon: Boxes
	},
	{
		id: 'Host',
		label: 'Host / VM fleet',
		description: 'Run an agent on each machine to ship its logs.',
		icon: Server
	},
	{
		id: 'Containers',
		label: 'Containers',
		description: 'Capture stdout/stderr from containers on a host.',
		icon: Container
	},
	{
		id: 'Application',
		label: 'Application code',
		description: 'Instrument a single service to emit logs directly.',
		icon: Code
	},
	{
		id: 'Cloud',
		label: 'Cloud provider',
		description: 'Forward logs from a managed cloud log stream.',
		icon: Cloud
	}
];
