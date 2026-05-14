import { otelEnv } from '$lib/server/send-logs';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const INSTALL_COMMAND =
	'pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http opentelemetry-instrumentation-logging';

const EXAMPLE_CODE = `import logging
from opentelemetry._logs import set_logger_provider
from opentelemetry.instrumentation.logging.handler import LoggingHandler
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter

logger_provider = LoggerProvider()
set_logger_provider(logger_provider)
logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))

logging.getLogger().addHandler(LoggingHandler(logger_provider=logger_provider))
logging.getLogger().setLevel(logging.INFO)

logging.info("Hello from Python to Logwiz")

logger_provider.shutdown()`;

const [installSnippet, exampleSnippet] = await Promise.all([
	snippet(INSTALL_COMMAND, 'bash'),
	snippet(EXAMPLE_CODE, 'python')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	return {
		snippets: {
			install: installSnippet,
			envVars: await snippet(otelEnv({ origin, token, serviceName: 'my-python-service' }), 'bash'),
			example: exampleSnippet
		}
	};
};
