import NginxIcon from '@iconify-svelte/logos/nginx';
import { vectorOtlpSinkSnippet } from './_shared';
import { highlightKey } from '../snippet-utils';
import type { Integration } from '../types';

const GROUP_ADD_COMMAND = 'sudo usermod -aG adm vector';

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = 'curl -i http://localhost/';

export const nginx: Integration = {
	id: 'nginx',
	label: 'Nginx',
	icon: NginxIcon,
	origin: 'Host',
	buildSteps: (ctx) => {
		const vectorConfig = `sources:
  nginx_logs:
    type: file
    include:
      - /var/log/nginx/access.log
      - /var/log/nginx/error.log
    read_from: end

${vectorOtlpSinkSnippet({ ctx, inputs: 'nginx_logs' })}`;

		return [
			{
				title: 'Install Vector',
				body:
					'Install the Vector package for your platform from the official installation page — ' +
					'per-distro instructions are maintained upstream.',
				linkOut: {
					label: 'Open Vector installation',
					href: 'https://vector.dev/docs/setup/installation/'
				}
			},
			{
				title: 'Write /etc/vector/vector.yaml',
				body:
					'Save this at /etc/vector/vector.yaml. The endpoint and API key are prefilled — ' +
					'lines arrive in rootprint as raw log bodies; structured parsing is documented separately.',
				snippets: [
					{
						code: vectorConfig,
						lang: 'yaml',
						copyTitle: 'Copy vector.yaml',
						highlightValue: highlightKey(ctx)
					}
				],
				callout: {
					variant: 'info',
					html:
						'Want combined-format parsing and severity mapping? See the ' +
						'<a href="https://docs.rootprint.io/send-logs/web-servers/nginx" target="_blank" rel="noreferrer" class="link">Nginx docs</a>.'
				}
			},
			{
				title: 'Grant Vector log access and restart it',
				body: 'Vector runs as its own user; add it to the adm group so it can read /var/log/nginx/*.',
				snippets: [
					{ code: GROUP_ADD_COMMAND, lang: 'bash', copyTitle: 'Copy group command' },
					{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }
				]
			},
			{
				title: 'Send a test request',
				body: 'A single curl is enough — Nginx writes the access line, Vector picks it up.',
				snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
				verify: {
					label: 'Open Search',
					href: `/?index=${encodeURIComponent(ctx.indexId)}`
				}
			}
		];
	}
};
