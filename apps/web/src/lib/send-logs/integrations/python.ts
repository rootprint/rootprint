import PythonIcon from '@iconify-svelte/logos/python';
import { otelEnvVarsSnippet } from './_shared';
import type { Integration } from '../types';

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

logging.info("Hello from Python to rootprint")`;

export const python: Integration = {
	id: 'python',
	label: 'Python',
	icon: PythonIcon,
	category: 'Languages',
	buildSteps: (ctx) => [
		{
			title: 'Install and configure',
			body:
				'rootprint accepts OTLP over HTTP (proto-http). Install the SDK, then set ' +
				'the endpoint and API key via environment variables.',
			snippets: [
				{ code: INSTALL_COMMAND, lang: 'bash', copyTitle: 'Copy install command' },
				otelEnvVarsSnippet({ ctx, serviceName: 'my-python-service' })
			],
			callout: {
				variant: 'warning',
				html:
					'The <code>%20</code> after <code>Bearer</code> is required — OTLP expects ' +
					'URL-encoded header values.'
			}
		},
		{
			title: 'Send your first log',
			body: 'Paste this into a fresh file to verify end-to-end delivery.',
			snippets: [{ code: EXAMPLE_CODE, lang: 'python', copyTitle: 'Copy example' }],
			verify: {
				label: 'Open Search',
				href: `/?index=${encodeURIComponent(ctx.indexId)}`
			}
		}
	]
};
