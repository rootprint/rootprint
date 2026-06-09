import DockerIcon from '@iconify-svelte/logos/docker-icon';
import { vectorOtlpSinkSnippet } from './_shared';
import { highlightKey } from '../snippet-utils';
import type { Integration } from '../types';

const COMPOSE_FRAGMENT = `services:
  rootprint-vector:
    image: timberio/vector:0.54.0-alpine
    container_name: rootprint-vector
    restart: unless-stopped
    volumes:
      - ./vector.yaml:/etc/vector/vector.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

const RUN_COMMAND = 'docker compose up -d rootprint-vector';

const TEST_COMMAND = 'docker run --rm alpine echo "hello from rootprint"';

export const docker: Integration = {
	id: 'docker',
	label: 'Docker',
	icon: DockerIcon,
	origin: 'Containers',
	buildSteps: (ctx) => {
		const vectorConfig = `sources:
  docker:
    type: docker_logs
    exclude_containers: [rootprint-vector]

${vectorOtlpSinkSnippet({ ctx, inputs: 'docker' })}`;

		return [
			{
				title: 'Write vector.yaml',
				body: 'Save this next to your docker-compose.yaml. The endpoint and API key are prefilled.',
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
						'Need severity inference or container attribute enrichment? See the ' +
						'<a href="https://docs.rootprint.io/send-logs/platforms/docker" target="_blank" rel="noreferrer" class="link">Docker docs</a>.'
				}
			},
			{
				title: 'Add Vector to your Compose project',
				body:
					'Merge this services block into your existing docker-compose.yaml. ' +
					'Vector watches the Docker daemon socket and ships container stdout/stderr to rootprint.',
				snippets: [{ code: COMPOSE_FRAGMENT, lang: 'yaml', copyTitle: 'Copy compose fragment' }]
			},
			{
				title: 'Start Vector',
				body: 'Bring up the new service in the background.',
				snippets: [{ code: RUN_COMMAND, lang: 'bash', copyTitle: 'Copy run command' }]
			},
			{
				title: 'Send a test log',
				body: 'Run any short-lived container — Vector picks up its stdout and forwards it to rootprint.',
				snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
				verify: {
					label: 'Open Search',
					href: `/?index=${encodeURIComponent(ctx.indexId)}`
				}
			}
		];
	}
};
