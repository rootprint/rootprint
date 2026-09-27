import NginxIcon from '@iconify-svelte/logos/nginx';
import { vectorOtlpSnippet } from './_shared';
import { highlightKey } from '../snippet-utils';
import type { Integration } from '../types';

const GROUP_ADD_COMMAND = `# Debian/Ubuntu: nginx logs belong to the adm group (the Vector package usually adds this)
sudo usermod -aG adm vector

# RHEL/Fedora/Amazon Linux: nginx logs are nginx:root 0640, so grant read access with ACLs
sudo setfacl -m u:vector:rx /var/log/nginx
sudo setfacl -m u:vector:r /var/log/nginx/*.log
sudo setfacl -d -m u:vector:r /var/log/nginx`;

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = 'curl -i http://localhost/';

export const nginx: Integration = {
	id: 'nginx',
	label: 'Nginx',
	icon: NginxIcon,
	origin: 'Infrastructure',
	docs: 'https://docs.rootprint.io/send-logs/web-servers/nginx',
	logs: {
		buildSteps: (ctx) => {
			const vectorConfig = `sources:
  nginx_logs:
    type: file
    include:
      - /var/log/nginx/access.log
      - /var/log/nginx/error.log
    read_from: end

${vectorOtlpSnippet({
	ctx,
	inputs: 'nginx_logs',
	serviceName: '"nginx"',
	attribute: ['log.file.path', '.file']
})}`;

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
						'Save this at /etc/vector/vector.yaml. It includes your endpoint and ingest key. Lines ' +
						'arrive in rootprint as raw log bodies; the docs cover structured parsing.',
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
					body: 'Vector runs as its own user and needs read access to /var/log/nginx/*. Run the lines for your distro.',
					snippets: [
						{ code: GROUP_ADD_COMMAND, lang: 'bash', copyTitle: 'Copy access commands' },
						{ code: RESTART_COMMAND, lang: 'bash', copyTitle: 'Copy restart command' }
					]
				},
				{
					title: 'Send a test request',
					body: 'A single curl is enough — Nginx writes the access line, Vector picks it up.',
					snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }]
				}
			];
		}
	}
};
