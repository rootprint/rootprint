import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const INSTALL_COMMAND = 'pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http';

const EXAMPLE_CODE = `import logging
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter

logger_provider = LoggerProvider()
set_logger_provider(logger_provider)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))

logging.getLogger().addHandler(LoggingHandler(logger_provider=logger_provider))
logging.getLogger().setLevel(logging.INFO)

logging.info("Hello from Python to Logwiz")`;

const INSTALL_SNIPPET = {
	code: INSTALL_COMMAND,
	html: await highlightCode(INSTALL_COMMAND, 'bash'),
	lang: 'bash'
};

const EXAMPLE_SNIPPET = {
	code: EXAMPLE_CODE,
	html: await highlightCode(EXAMPLE_CODE, 'python'),
	lang: 'python'
};

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const envVars = `export OTEL_SERVICE_NAME=my-python-service
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}
export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`;

	return {
		snippets: {
			install: INSTALL_SNIPPET,
			envVars: {
				code: envVars,
				html: await highlightCode(envVars, 'bash'),
				lang: 'bash'
			},
			example: EXAMPLE_SNIPPET
		}
	};
};
