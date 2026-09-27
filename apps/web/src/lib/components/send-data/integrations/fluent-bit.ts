import FluentBitIcon from '@iconify-svelte/simple-icons/fluentbit';
import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import type { Integration } from '../types';

// The packaged unit hard-codes fluent-bit.conf; /opt/fluent-bit/bin is the official packages' prefix.
const UNIT_OVERRIDE_COMMAND = `sudo mkdir -p /etc/systemd/system/fluent-bit.service.d
printf '[Service]\\nExecStart=\\nExecStart=/opt/fluent-bit/bin/fluent-bit -c /etc/fluent-bit/fluent-bit.yaml\\n' \\
  | sudo tee /etc/systemd/system/fluent-bit.service.d/yaml.conf
sudo systemctl daemon-reload`;

const RESTART_COMMAND = `sudo systemctl restart fluent-bit
sudo systemctl status fluent-bit`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from fluent-bit" | sudo tee -a /var/log/myapp/test.log`;

export const fluentBit: Integration = {
	id: 'fluent-bit',
	label: 'Fluent Bit',
	icon: FluentBitIcon,
	origin: 'Agents',
	docs: 'https://docs.rootprint.io/send-logs/log-agents/fluent-bit',
	logs: {
		buildSteps: (ctx) => {
			const url = new URL(ctx.origin);
			const host = url.hostname;
			const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
			const tls = url.protocol === 'https:' ? 'on' : 'off';

			// YAML because resource attributes need processors, which the classic format lacks.
			const config = `service:
  flush: 1
  log_level: info

pipeline:
  inputs:
    - name: tail
      path: /var/log/myapp/*.log
      tag: myapp.*
      processors:
        logs:
          - name: opentelemetry_envelope
          - name: content_modifier
            context: otel_resource_attributes
            action: upsert
            key: service.name
            value: myapp

  outputs:
    - name: opentelemetry
      match: "*"
      host: ${host}
      port: ${port}
      tls: ${tls}
      tls.verify: on
      logs_uri: ${OTLP_LOGS_INGEST_PATH}
      header: Authorization Bearer ${ctx.apiKey}
      logs_body_key: $log
      compress: gzip
      retry_limit: no_limits
      log_response_payload: true`;

			return [
				{
					title: 'Install Fluent Bit',
					body:
						'Install Fluent Bit for your platform from the official installation page — ' +
						'per-distro instructions are maintained upstream.',
					linkOut: {
						label: 'Open Fluent Bit installation',
						href: 'https://docs.fluentbit.io/manual/installation/getting-started-with-fluent-bit'
					}
				},
				{
					title: 'Write /etc/fluent-bit/fluent-bit.yaml',
					body:
						"Replace /var/log/myapp/*.log with the glob that matches your application's logs, " +
						'and myapp with its service name.',
					snippets: [
						{
							code: config,
							lang: 'yaml',
							copyTitle: 'Copy fluent-bit.yaml',
							highlightValue: highlightKey(ctx)
						}
					]
				},
				{
					title: 'Point the service at the YAML file',
					body: 'The package’s systemd unit loads fluent-bit.conf; this drop-in swaps in the YAML file.',
					snippets: [
						{ code: UNIT_OVERRIDE_COMMAND, lang: 'bash', copyTitle: 'Copy override commands' }
					]
				},
				{
					title: 'Restart Fluent Bit',
					snippets: [{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }]
				},
				{
					title: 'Send a test log line',
					body: 'Append a line to the watched log path and wait a second.',
					snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }]
				}
			];
		}
	}
};
