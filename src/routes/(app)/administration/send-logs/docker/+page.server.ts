import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const COMPOSE_FRAGMENT = `services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.113.0
    container_name: otel-collector
    restart: unless-stopped
    user: "0:0"
    volumes:
      - ./otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro`;

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
    include_file_path: true
    operators:
      - type: container
        format: docker
        on_error: send_quiet

processors:
  transform/enrich:
    log_statements:
      - context: log
        statements:
          - merge_maps(resource.attributes, ExtractPatterns(attributes["log.file.path"], "^/var/lib/docker/containers/(?P<container_id>[a-f0-9]{64})/"), "upsert") where attributes["log.file.path"] != nil
      - context: resource
        statements:
          - set(attributes["container.id"], attributes["container_id"]) where attributes["container_id"] != nil
          - delete_key(attributes, "container_id") where attributes["container_id"] != nil
          - set(attributes["service.name"], attributes["container.id"]) where attributes["service.name"] == nil and attributes["container.id"] != nil
  filter/exclude_self:
    error_mode: ignore
    logs:
      log_record:
        - 'resource.attributes["container.id"] != nil and IsMatch(resource.attributes["container.id"], "^\${env:HOSTNAME}")'
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
      processors: [transform/enrich, filter/exclude_self, batch]
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
