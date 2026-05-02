import nginxIcon from '@iconify-icons/logos/nginx';
import nodejsIcon from '@iconify-icons/logos/nodejs-icon';
import pythonIcon from '@iconify-icons/logos/python';

import caddyLogo from '$lib/assets/caddy-logo.png';
import type { BuiltinView } from '$lib/types';

// Built-in Views ship with logwiz and are always available on OTel indexes.
// Each view's query narrows by the canonical field for its source:
// `service_name` is Quickwit's promoted top-level form of OTLP service.name;
// `resource_attributes.*` paths cover non-promoted OTLP resource attributes.
// Icons mirror the matching Send-Logs wizard cards.
export const BUILTIN_VIEWS: BuiltinView[] = [
	{
		slug: 'caddy',
		name: 'Caddy',
		query: 'service_name:"caddy"',
		columns: [
			'resource_attributes.host.name',
			'attributes.client.address',
			'attributes.http.request.method',
			'attributes.http.request.uri',
			'attributes.http.status_code'
		],
		icon: { iconSrc: caddyLogo }
	},
	{
		slug: 'nginx',
		name: 'Nginx',
		query: 'service_name:"nginx"',
		columns: ['resource_attributes.host.name'],
		icon: { iconifyIcon: nginxIcon }
	},
	{
		slug: 'python-sdk',
		name: 'Python SDK',
		query: 'resource_attributes.telemetry\\.sdk\\.language:"python"',
		columns: [
			'service_name',
			'attributes.code.function.name',
			'attributes.code.file.path',
			'attributes.code.line.number'
		],
		icon: { iconifyIcon: pythonIcon }
	},
	{
		slug: 'node-sdk',
		name: 'Node SDK',
		query: 'resource_attributes.telemetry\\.sdk\\.language:"nodejs"',
		columns: [
			'service_name',
			'resource_attributes.process.runtime.name',
			'resource_attributes.process.runtime.version'
		],
		icon: { iconifyIcon: nodejsIcon }
	}
];
