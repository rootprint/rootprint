import NodejsIcon from '@iconify-svelte/logos/nodejs-icon';
import { otelEnvVarsSnippet } from './_shared';
import type { Integration, IntegrationContext, Step } from '../types';

const OTEL_INSTALL =
	'npm install @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-proto @opentelemetry/resources';

const OTEL_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { defaultResource, detectResources, envDetector } from '@opentelemetry/resources';

// Pick up service.name (and anything in OTEL_RESOURCE_ATTRIBUTES) from the environment
const resource = defaultResource().merge(
  detectResources({ detectors: [envDetector] })
);

const provider = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});

logs.setGlobalLoggerProvider(provider);

logs.getLogger('hello').emit({ severityText: 'INFO', body: 'Hello from Node to rootprint' });

await provider.forceFlush();
await provider.shutdown();`;

const PINO_INSTALL = 'npm install pino pino-opentelemetry-transport';

const PINO_EXAMPLE = `import pino from 'pino';

const transport = pino.transport({
	target: 'pino-opentelemetry-transport'
});

const log = pino(transport);
log.info('Hello from Pino to rootprint');`;

const WINSTON_INSTALL =
	'npm install winston @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-proto @opentelemetry/winston-transport @opentelemetry/resources';

const WINSTON_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { defaultResource, detectResources, envDetector } from '@opentelemetry/resources';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import winston from 'winston';

const resource = defaultResource().merge(
  detectResources({ detectors: [envDetector] })
);

const provider = new LoggerProvider({
  resource,
  processors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});

logs.setGlobalLoggerProvider(provider);

const logger = winston.createLogger({
  level: 'info',
  transports: [new OpenTelemetryTransportV3()]
});

logger.info('Hello from Winston to rootprint');

await provider.shutdown();`;

const PROTOBUF_CALLOUT = {
	variant: 'warning' as const,
	html:
		'rootprint accepts <strong>protobuf only</strong>. Use ' +
		'<code>@opentelemetry/exporter-logs-otlp-proto</code> — not the JSON-defaulting ' +
		'<code>@opentelemetry/exporter-logs-otlp-http</code>.'
};

const BEARER_CALLOUT = {
	variant: 'warning' as const,
	html:
		'The <code>%20</code> after <code>Bearer</code> is required — OTLP expects ' +
		'URL-encoded header values.'
};

function otelSteps(ctx: IntegrationContext): Step[] {
	return [
		{
			title: 'Install and configure',
			body:
				'Install the OTel SDK and the protobuf log exporter. Then set the endpoint ' +
				'and API key via environment variables.',
			snippets: [
				{ code: OTEL_INSTALL, lang: 'bash', copyTitle: 'Copy install command' },
				otelEnvVarsSnippet({ ctx, serviceName: 'my-node-service' })
			],
			callout: BEARER_CALLOUT
		},
		{
			title: 'Send your first log',
			body: 'Save this to a file and run it with Node 18+ (ESM).',
			snippets: [{ code: OTEL_EXAMPLE, lang: 'javascript', copyTitle: 'Copy example' }],
			callout: PROTOBUF_CALLOUT,
			verify: {
				label: 'Open Search',
				href: `/?index=${encodeURIComponent(ctx.indexId)}`
			}
		}
	];
}

function pinoSteps(ctx: IntegrationContext): Step[] {
	return [
		{
			title: 'Install and configure',
			body:
				'Pino ships its own OTel transport. Install both, then set the standard ' +
				'OTel environment variables — the transport reads them automatically.',
			snippets: [
				{ code: PINO_INSTALL, lang: 'bash', copyTitle: 'Copy install command' },
				otelEnvVarsSnippet({ ctx, serviceName: 'my-node-service' })
			],
			callout: BEARER_CALLOUT
		},
		{
			title: 'Send your first log',
			body: 'Wire the transport into a Pino logger and emit a record.',
			snippets: [{ code: PINO_EXAMPLE, lang: 'javascript', copyTitle: 'Copy example' }],
			verify: {
				label: 'Open Search',
				href: `/?index=${encodeURIComponent(ctx.indexId)}`
			}
		}
	];
}

function winstonSteps(ctx: IntegrationContext): Step[] {
	return [
		{
			title: 'Install and configure',
			body:
				'Install Winston with the OTel transport, plus the OTel SDK and ' +
				'protobuf log exporter. Set the standard OTel environment variables.',
			snippets: [
				{ code: WINSTON_INSTALL, lang: 'bash', copyTitle: 'Copy install command' },
				otelEnvVarsSnippet({ ctx, serviceName: 'my-node-service' })
			],
			callout: BEARER_CALLOUT
		},
		{
			title: 'Send your first log',
			body: 'Wire the OTel transport into a Winston logger and emit a record.',
			snippets: [{ code: WINSTON_EXAMPLE, lang: 'javascript', copyTitle: 'Copy example' }],
			callout: PROTOBUF_CALLOUT,
			verify: {
				label: 'Open Search',
				href: `/?index=${encodeURIComponent(ctx.indexId)}`
			}
		}
	];
}

export const nodejs: Integration = {
	id: 'nodejs',
	label: 'Node.js',
	icon: NodejsIcon,
	category: 'Languages',
	flavors: [
		{ id: 'otel', label: 'OpenTelemetry' },
		{ id: 'pino', label: 'Pino' },
		{ id: 'winston', label: 'Winston' }
	],
	defaultFlavor: 'otel',
	buildSteps: (ctx) => {
		switch (ctx.flavor) {
			case 'pino':
				return pinoSteps(ctx);
			case 'winston':
				return winstonSteps(ctx);
			default:
				return otelSteps(ctx);
		}
	}
};
