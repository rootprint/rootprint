import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const COMPOSE_FRAGMENT = `services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.113.0
    container_name: otel-collector
    restart: unless-stopped
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

const RUN_COMMAND = 'docker compose up -d otel-collector';

const TEST_COMMAND = 'docker run --rm --name logwiz-smoke-test alpine echo "hello from logwiz"';

const COMPOSE_SNIPPET = {
	code: COMPOSE_FRAGMENT,
	html: await highlightCode(COMPOSE_FRAGMENT, 'yaml'),
	lang: 'yaml'
};

const RUN_SNIPPET = {
	code: RUN_COMMAND,
	html: await highlightCode(RUN_COMMAND, 'bash'),
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

	const collectorConfig = `receivers:
  filelog:
    include: [/var/lib/docker/containers/*/*.log]
    start_at: end
    operators:
      - type: container
        format: docker

processors:
  filter/exclude_self:
    error_mode: ignore
    logs:
      log_record:
        - 'resource.attributes["container.name"] == "otel-collector"'
  batch:
    timeout: 5s

exporters:
  otlphttp:
    logs_endpoint: ${origin}${OTLP_LOGS_INGEST_PATH}
    headers:
      authorization: "Bearer ${token}"

service:
  pipelines:
    logs:
      receivers: [filelog]
      processors: [filter/exclude_self, batch]
      exporters: [otlphttp]`;

	return {
		snippets: {
			collectorConfig: {
				code: collectorConfig,
				html: await highlightCode(collectorConfig, 'yaml'),
				lang: 'yaml'
			},
			compose: COMPOSE_SNIPPET,
			run: RUN_SNIPPET,
			test: TEST_SNIPPET
		}
	};
};
