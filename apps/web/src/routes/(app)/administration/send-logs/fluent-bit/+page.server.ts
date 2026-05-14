import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const RESTART_COMMAND = `sudo systemctl restart fluent-bit
sudo systemctl status fluent-bit`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from fluent-bit" | sudo tee -a /var/log/myapp/test.log`;

const [restartSnippet, testSnippet] = await Promise.all([
	snippet(RESTART_COMMAND, 'bash'),
	snippet(TEST_COMMAND, 'bash')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const url = new URL(origin);
	const host = url.hostname;
	const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
	const tls = url.protocol === 'https:' ? 'On' : 'Off';

	const fluentBitConfig = `[SERVICE]
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
    Header                Authorization Bearer ${token}
    Logs_body_key         $log
    Log_response_payload  True`;

	return {
		snippets: {
			fluentBitConfig: await snippet(fluentBitConfig, 'ini'),
			restart: restartSnippet,
			test: testSnippet
		}
	};
};
