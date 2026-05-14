import { otelEnv } from '$lib/server/send-logs';
import { type CodeSnippet, snippet } from '$lib/server/syntax';
import type { NodeLogFlavor } from '$lib/types';

import type { PageServerLoad } from './$types';

const OTEL_INSTALL =
	'npm install @opentelemetry/api-logs @opentelemetry/sdk-node @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-proto';

const OTEL_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';

const sdk = new NodeSDK({
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});

sdk.start();

logs.getLogger('hello').emit({ severityText: 'INFO', body: 'Hello from Node to Logwiz' });
await sdk.shutdown();`;

const PINO_INSTALL = 'npm install pino pino-opentelemetry-transport';

const PINO_EXAMPLE = `import pino from 'pino';

const transport = pino.transport({
	target: 'pino-opentelemetry-transport'
});

const log = pino(transport);
log.info('Hello from Pino to Logwiz');`;

const WINSTON_INSTALL =
	'npm install winston @opentelemetry/api-logs @opentelemetry/sdk-node @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-proto @opentelemetry/winston-transport';

const WINSTON_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import winston from 'winston';

const sdk = new NodeSDK({
    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});

sdk.start();

const logger = winston.createLogger({
	level: 'info',
	transports: [new OpenTelemetryTransportV3()]
});

logger.info('Hello from Winston to Logwiz');`;

type FlavorSnippets = {
	install: CodeSnippet;
	example: CodeSnippet;
};

const [
	otelInstallSnippet,
	otelExampleSnippet,
	pinoInstallSnippet,
	pinoExampleSnippet,
	winstonInstallSnippet,
	winstonExampleSnippet
] = await Promise.all([
	snippet(OTEL_INSTALL, 'bash'),
	snippet(OTEL_EXAMPLE, 'javascript'),
	snippet(PINO_INSTALL, 'bash'),
	snippet(PINO_EXAMPLE, 'javascript'),
	snippet(WINSTON_INSTALL, 'bash'),
	snippet(WINSTON_EXAMPLE, 'javascript')
]);

const FLAVORS: Record<NodeLogFlavor, FlavorSnippets> = {
	otel: { install: otelInstallSnippet, example: otelExampleSnippet },
	pino: { install: pinoInstallSnippet, example: pinoExampleSnippet },
	winston: { install: winstonInstallSnippet, example: winstonExampleSnippet }
};

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	return {
		envVars: await snippet(otelEnv({ origin, token, serviceName: 'my-node-service' }), 'bash'),
		flavors: FLAVORS
	};
};
