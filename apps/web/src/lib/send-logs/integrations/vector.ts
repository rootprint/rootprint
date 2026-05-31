import VectorIcon from '@iconify-svelte/logos/vector-timber';
import { vectorOtlpSinkSnippet } from './_shared';
import type { Integration } from '../types';

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from vector" | sudo tee -a /var/log/myapp/test.log`;

export const vector: Integration = {
	id: 'vector',
	label: 'Vector',
	icon: VectorIcon,
	category: 'Log Agents',
	buildSteps: (ctx) => {
		const vectorConfig = `sources:
  app_logs:
    type: file
    include:
      - /var/log/myapp/*.log
    read_from: end

${vectorOtlpSinkSnippet({ ctx, inputs: 'app_logs' })}`;

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
					'Save this at /etc/vector/vector.yaml. Replace /var/log/myapp/*.log with the glob ' +
					"that matches your application's log files.",
				snippets: [{ code: vectorConfig, lang: 'yaml', copyTitle: 'Copy vector.yaml' }]
			},
			{
				title: 'Restart Vector',
				snippets: [{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }]
			},
			{
				title: 'Append a test line',
				body: 'Append a line to the watched log path and wait a second.',
				snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
				verify: {
					label: 'Open Search',
					href: `/?index=${encodeURIComponent(ctx.indexId)}`
				}
			}
		];
	}
};
