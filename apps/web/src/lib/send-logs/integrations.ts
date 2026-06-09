import { docker } from './integrations/docker';
import { fluentBit } from './integrations/fluent-bit';
import { go } from './integrations/go';
import { nginx } from './integrations/nginx';
import { nodejs } from './integrations/nodejs';
import { otelCollector } from './integrations/otel-collector';
import { python } from './integrations/python';
import { vector } from './integrations/vector';
import type { Integration } from './types';

export const integrations: Integration[] = [
	otelCollector,
	python,
	nodejs,
	go,
	docker,
	nginx,
	fluentBit,
	vector
];

export const integrationById = new Map<string, Integration>(integrations.map((i) => [i.id, i]));
