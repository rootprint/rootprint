import OtelCollectorIcon from '@iconify-svelte/logos/opentelemetry-icon';
import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import { searchVerifyLink } from './_shared';
import type { Integration } from '../types';

const RESTART_COMMAND = `sudo systemctl restart otelcol-contrib
sudo systemctl status otelcol-contrib`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from the otel collector" | sudo tee -a /var/log/myapp/test.log`;

export const otelCollector: Integration = {
	id: 'otel-collector',
	label: 'OpenTelemetry Collector',
	icon: OtelCollectorIcon,
	origin: 'OpenTelemetry',
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
};
