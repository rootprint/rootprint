import FluentBitIcon from '@iconify-svelte/simple-icons/fluentbit';
import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import { searchVerifyLink } from './_shared';
import type { Integration } from '../types';

const RESTART_COMMAND = `sudo systemctl restart fluent-bit
sudo systemctl status fluent-bit`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from fluent-bit" | sudo tee -a /var/log/myapp/test.log`;

export const fluentBit: Integration = {
	id: 'fluent-bit',
	label: 'Fluent Bit',
	icon: FluentBitIcon,
	origin: 'LogAgents',
	buildSteps: (ctx) => {
		const url = new URL(ctx.origin);
		const host = url.hostname;
		const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
		const tls = url.protocol === 'https:' ? 'On' : 'Off';

		const config = `[SERVICE]
    Flush         1
    Log_Level     info
    Daemon        Off
    HTTP_Server   Off

[INPUT]
    Name             tail
    Path             /var/log/myapp/*.log
    Tag              myapp.*
    Read_from_Head   False

[OUTPUT]
    Name                  opentelemetry
    Match                 *
    Host                  ${host}
    Port                  ${port}
    Tls                   ${tls}
    Tls.verify            On
    Logs_uri              ${OTLP_LOGS_INGEST_PATH}
    Header                Authorization Bearer ${ctx.apiKey}
    Logs_body_key         $log
    Log_response_payload  True`;

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
				title: 'Configure /etc/fluent-bit/fluent-bit.conf',
				body: "Replace /var/log/myapp/*.log with the glob that matches your application's logs.",
				snippets: [
					{
						code: config,
						lang: 'ini',
						copyTitle: 'Copy fluent-bit.conf',
						highlightValue: highlightKey(ctx)
					}
				]
			},
			{
				title: 'Restart Fluent Bit',
				snippets: [{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }]
			},
			{
				title: 'Send a test log line',
				body: 'Append a line to the watched log path and wait a second.',
				snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
				verify: searchVerifyLink(ctx.indexId)
			}
		];
	}
};
