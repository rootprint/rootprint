import OtelCollectorIcon from '@iconify-svelte/logos/opentelemetry-icon';
import { OTLP_LOGS_INGEST_PATH, OTLP_TRACES_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import { COLLECTOR_CORRELATION_CALLOUT, searchVerifyLink } from './_shared';
import type { Integration } from '../types';

const RESTART_COMMAND = `sudo systemctl restart otelcol-contrib
sudo systemctl status otelcol-contrib`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from the otel collector" | sudo tee -a /var/log/myapp/test.log`;

const TRACE_TEST_COMMAND = `NOW=$(date +%s)
curl -sS -X POST http://localhost:4318/v1/traces \\
  -H 'content-type: application/json' \\
  -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"curl-smoke-test"}}]},"scopeSpans":[{"spans":[{"traceId":"5b8efff798038103d269b633813fc60c","spanId":"eee19b7ec3c1b174","name":"hello-from-curl","kind":2,"startTimeUnixNano":"'"\${NOW}000000000"'","endTimeUnixNano":"'"\${NOW}100000000"'"}]}]}]}'`;

export const otelCollector: Integration = {
	id: 'otel-collector',
	label: 'OpenTelemetry Collector',
	icon: OtelCollectorIcon,
	origin: 'OpenTelemetry',
	docs: 'https://docs.rootprint.io/send-logs/log-agents/otel-collector',
	logs: {
		buildSteps: (ctx) => {
			const config = `receivers:
  filelog:
    include:
      - /var/log/myapp/*.log
    start_at: end

processors:
  batch: {}

exporters:
  otlphttp:
    logs_endpoint: ${ctx.origin}${OTLP_LOGS_INGEST_PATH}
    compression: gzip
    headers:
      Authorization: "Bearer ${ctx.apiKey}"

service:
  pipelines:
    logs:
      receivers: [filelog]
      processors: [batch]
      exporters: [otlphttp]`;

			return [
				{
					title: 'Install the OpenTelemetry Collector',
					body:
						'Install the Contrib distribution (otelcol-contrib) for your platform — it bundles the ' +
						'filelog receiver used below. Per-platform packages are maintained upstream.',
					linkOut: {
						label: 'Open Collector installation',
						href: 'https://opentelemetry.io/docs/collector/installation/'
					}
				},
				{
					title: 'Write /etc/otelcol-contrib/config.yaml',
					body:
						'Save this at /etc/otelcol-contrib/config.yaml. Replace /var/log/myapp/*.log with the ' +
						"glob that matches your application's log files.",
					snippets: [
						{
							code: config,
							lang: 'yaml',
							copyTitle: 'Copy config.yaml',
							highlightValue: highlightKey(ctx)
						}
					]
				},
				{
					title: 'Restart the Collector',
					snippets: [{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }]
				},
				{
					title: 'Append a test line',
					body: 'Append a line to the watched log path and wait a second.',
					snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
					verify: searchVerifyLink(ctx.indexId)
				}
			];
		}
	},
	traces: {
		buildSteps: (ctx) => {
			const config = `receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch: {}

exporters:
  otlphttp:
    traces_endpoint: ${ctx.origin}${OTLP_TRACES_INGEST_PATH}
    compression: gzip
    headers:
      Authorization: "Bearer ${ctx.apiKey}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]`;

			return [
				{
					title: 'Install the OpenTelemetry Collector',
					body:
						'Install the Contrib distribution (otelcol-contrib) for your platform. Per-platform ' +
						'packages are maintained upstream.',
					linkOut: {
						label: 'Open Collector installation',
						href: 'https://opentelemetry.io/docs/collector/installation/'
					}
				},
				{
					title: 'Write /etc/otelcol-contrib/config.yaml',
					body:
						'Save this at /etc/otelcol-contrib/config.yaml. The otlp receiver listens on 4317 ' +
						'(gRPC) and 4318 (HTTP) — point your instrumented services at it instead of at ' +
						'rootprint directly, and the Collector batches and forwards their spans. If you ' +
						'already set up the Logs tab, merge this receiver, exporter, and pipeline into that ' +
						'file instead of replacing it.',
					snippets: [
						{
							code: config,
							lang: 'yaml',
							copyTitle: 'Copy config.yaml',
							highlightValue: highlightKey(ctx)
						}
					]
				},
				{
					title: 'Restart the Collector',
					snippets: [{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }]
				},
				{
					title: 'Send a test span',
					body:
						'Posts one span to the Collector’s own OTLP receiver. JSON is fine on this hop — the ' +
						'Collector re-encodes to protobuf on export. The ids are fixed, so repeat runs add ' +
						'spans to the same trace.',
					snippets: [{ code: TRACE_TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
					callout: COLLECTOR_CORRELATION_CALLOUT
				}
			];
		}
	}
};
