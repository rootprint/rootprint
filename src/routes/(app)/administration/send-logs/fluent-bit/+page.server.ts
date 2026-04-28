import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const APT_INSTALL = `curl https://packages.fluentbit.io/fluentbit.key | sudo gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/debian/$(lsb_release -cs) $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/fluent-bit.list
sudo apt-get update
sudo apt-get install -y fluent-bit`;

const DNF_INSTALL = `sudo tee /etc/yum.repos.d/fluent-bit.repo <<'EOF'
[fluent-bit]
name = Fluent Bit
baseurl = https://packages.fluentbit.io/centos/$releasever/$basearch/
gpgcheck=1
gpgkey=https://packages.fluentbit.io/fluentbit.key
enabled=1
EOF
sudo dnf install -y fluent-bit`;

const RESTART_COMMAND = `sudo systemctl restart fluent-bit
sudo systemctl status fluent-bit`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from fluent-bit" | sudo tee -a /var/log/myapp/test.log`;

const APT_SNIPPET = {
	code: APT_INSTALL,
	html: await highlightCode(APT_INSTALL, 'bash'),
	lang: 'bash'
};

const DNF_SNIPPET = {
	code: DNF_INSTALL,
	html: await highlightCode(DNF_INSTALL, 'bash'),
	lang: 'bash'
};

const RESTART_SNIPPET = {
	code: RESTART_COMMAND,
	html: await highlightCode(RESTART_COMMAND, 'bash'),
	lang: 'bash'
};

const TEST_SNIPPET = {
	code: TEST_COMMAND,
	html: await highlightCode(TEST_COMMAND, 'bash'),
	lang: 'bash'
};

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
    DB               /var/lib/fluent-bit/myapp.db

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
			apt: APT_SNIPPET,
			dnf: DNF_SNIPPET,
			fluentBitConfig: {
				code: fluentBitConfig,
				html: await highlightCode(fluentBitConfig, 'ini'),
				lang: 'ini'
			},
			restart: RESTART_SNIPPET,
			test: TEST_SNIPPET
		}
	};
};
