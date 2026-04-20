import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';
import type { NodeLogFlavor } from '$lib/types';

import type { PageServerLoad } from './$types';

const OTEL_INSTALL =
	'npm install @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-http';

const OTEL_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

const provider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});
logs.setGlobalLoggerProvider(provider);

logs.getLogger('hello').emit({ severityText: 'INFO', body: 'Hello from Node to Logwiz' });
await provider.forceFlush();`;

const PINO_INSTALL = 'npm install pino pino-opentelemetry-transport';

const PINO_EXAMPLE = `import pino from 'pino';

const transport = pino.transport({
	target: 'pino-opentelemetry-transport'
});

const log = pino(transport);
log.info('Hello from Pino to Logwiz');`;

const WINSTON_INSTALL =
	'npm install winston @opentelemetry/api-logs @opentelemetry/sdk-logs @opentelemetry/exporter-logs-otlp-http @opentelemetry/winston-transport';

const WINSTON_EXAMPLE = `import { logs } from '@opentelemetry/api-logs';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import winston from 'winston';

const provider = new LoggerProvider({
    processors: [new BatchLogRecordProcessor(new OTLPLogExporter())]
});
logs.setGlobalLoggerProvider(provider);

const logger = winston.createLogger({
	level: 'info',
	transports: [new OpenTelemetryTransportV3()]
});

logger.info('Hello from Winston to Logwiz');`;

type FlavorSnippets = {
	install: { code: string; html: string; lang: string };
	example: { code: string; html: string; lang: string };
};

const [
	otelInstallHtml,
	otelExampleHtml,
	pinoInstallHtml,
	pinoExampleHtml,
	winstonInstallHtml,
	winstonExampleHtml
] = await Promise.all([
	highlightCode(OTEL_INSTALL, 'bash'),
	highlightCode(OTEL_EXAMPLE, 'javascript'),
	highlightCode(PINO_INSTALL, 'bash'),
	highlightCode(PINO_EXAMPLE, 'javascript'),
	highlightCode(WINSTON_INSTALL, 'bash'),
	highlightCode(WINSTON_EXAMPLE, 'javascript')
]);

const FLAVORS: Record<NodeLogFlavor, FlavorSnippets> = {
	otel: {
		install: { code: OTEL_INSTALL, html: otelInstallHtml, lang: 'bash' },
		example: { code: OTEL_EXAMPLE, html: otelExampleHtml, lang: 'javascript' }
	},
	pino: {
		install: { code: PINO_INSTALL, html: pinoInstallHtml, lang: 'bash' },
		example: { code: PINO_EXAMPLE, html: pinoExampleHtml, lang: 'javascript' }
	},
	winston: {
		install: { code: WINSTON_INSTALL, html: winstonInstallHtml, lang: 'bash' },
		example: { code: WINSTON_EXAMPLE, html: winstonExampleHtml, lang: 'javascript' }
	}
};

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const envVars = `export OTEL_SERVICE_NAME=my-node-service
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}
export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`;

	return {
		envVars: {
			code: envVars,
			html: await highlightCode(envVars, 'bash'),
			lang: 'bash'
		},
		flavors: FLAVORS
	};
};
