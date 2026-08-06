import PythonIcon from '@iconify-svelte/logos/python';
import {
	BEARER_CALLOUT,
	CORRELATION_CALLOUT,
	otelEnvVarsSnippet,
	searchVerifyLink
} from './_shared';
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

const TRACES_INSTALL_COMMAND = `pip install opentelemetry-distro opentelemetry-exporter-otlp-proto-http
opentelemetry-bootstrap -a install`;

const TRACES_RUN_COMMAND = 'opentelemetry-instrument python app.py';

export const python: Integration = {
	id: 'python',
	label: 'Python',
	icon: PythonIcon,
	origin: 'Application',
	docs: 'https://docs.rootprint.io/send-logs/languages/python',
	logs: {
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
				callout: BEARER_CALLOUT
			},
			{
				title: 'Send your first log',
				body: 'Paste this into a fresh file to verify end-to-end delivery.',
				snippets: [{ code: EXAMPLE_CODE, lang: 'python', copyTitle: 'Copy example' }],
				verify: searchVerifyLink(ctx.indexId)
			}
		]
	},
	traces: {
		buildSteps: (ctx) => [
			{
				title: 'Install the zero-code agent',
				body:
					'opentelemetry-distro brings the agent and the SDK; the proto-http exporter is the one ' +
					'rootprint accepts. opentelemetry-bootstrap then reads your installed packages and adds ' +
					'the matching instrumentation libraries, so Flask, Django, FastAPI, requests, psycopg ' +
					'and friends are traced without touching your code.',
				snippets: [
					{ code: TRACES_INSTALL_COMMAND, lang: 'bash', copyTitle: 'Copy install commands' }
				]
			},
			{
				title: 'Set environment variables',
				body:
					'The agent reads all of its configuration from the environment. Metrics and logs are ' +
					'switched off here — they default to otlp and would retry localhost:4318 forever.',
				snippets: [
					otelEnvVarsSnippet({
						ctx,
						serviceName: 'my-python-service',
						includeProtocol: true,
						signal: 'traces',
						disableOtherSignals: true
					})
				],
				callout: BEARER_CALLOUT
			},
			{
				title: 'Run your app under the agent',
				body:
					'opentelemetry-instrument wraps your entrypoint. Exercise a route and the spans are ' +
					'batched and exported within a few seconds.',
				snippets: [{ code: TRACES_RUN_COMMAND, lang: 'bash', copyTitle: 'Copy run command' }],
				callout: CORRELATION_CALLOUT
			}
		]
	}
};
