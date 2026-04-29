import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const COMPOSE_FRAGMENT = `services:
  logwiz-vector:
    image: timberio/vector:0.54.0-alpine
    container_name: logwiz-vector
    restart: unless-stopped
    volumes:
      - ./vector.yaml:/etc/vector/vector.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

const RUN_COMMAND = 'docker compose up -d logwiz-vector';

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

	const collectorConfig = `sources:
  docker:
    type: docker_logs
    exclude_containers:
      - logwiz-vector

transforms:
  enrich:
    type: remap
    inputs: [docker]
    source: |
      .message = to_string(.message) ?? ""
      lower = downcase(.message)
      if match(lower, r'\\berror\\b|\\bfatal\\b|\\bpanic\\b|\\bexception\\b') {
        .severity_number = 17
        .severity_text   = "ERROR"
      } else if match(lower, r'\\bwarn(ing)?\\b|\\bdeprecated\\b|\\bretry\\b') {
        .severity_number = 13
        .severity_text   = "WARN"
      } else {
        .severity_number = 9
        .severity_text   = "INFO"
      }

  to_otlp:
    type: remap
    inputs: [enrich]
    source: |
      msg = string!(.message)
      ts_nano = to_unix_timestamp(now(), unit: "nanoseconds")
      if exists(.timestamp) && is_timestamp(.timestamp) {
        ts_nano = to_unix_timestamp!(.timestamp, unit: "nanoseconds")
      }
      sev_num  = to_int(.severity_number) ?? 9
      sev_text = string(.severity_text)   ?? "INFO"

      cname = string(.container_name) ?? ""
      cname = replace(cname, r'^/', "")
      svc_name = "unknown_service"
      if cname != "" { svc_name = cname }

      attrs = [
        { "key": "container.runtime", "value": { "stringValue": "docker" } }
      ]
      if exists(.container_id) { attrs = push(attrs, { "key": "container.id",         "value": { "stringValue": string!(.container_id) } }) }
      if cname != ""           { attrs = push(attrs, { "key": "container.name",       "value": { "stringValue": cname } }) }
      if exists(.image)        { attrs = push(attrs, { "key": "container.image.name", "value": { "stringValue": string!(.image) } }) }
      if exists(.image_id)     { attrs = push(attrs, { "key": "container.image.id",   "value": { "stringValue": string!(.image_id) } }) }
      if exists(.stream)       { attrs = push(attrs, { "key": "log.iostream",         "value": { "stringValue": string!(.stream) } }) }

      . = {
        "resourceLogs": [{
          "resource": {
            "attributes": [
              { "key": "service.name", "value": { "stringValue": svc_name } },
              { "key": "host.name",    "value": { "stringValue": get_hostname!() } }
            ]
          },
          "scopeLogs": [{
            "scope": { "name": "vector", "version": "" },
            "logRecords": [{
              "timeUnixNano":         ts_nano,
              "observedTimeUnixNano": to_unix_timestamp(now(), unit: "nanoseconds"),
              "severityNumber":       sev_num,
              "severityText":         sev_text,
              "body":                 { "stringValue": msg },
              "attributes":           attrs,
              "traceId":              "",
              "spanId":               "",
              "flags":                0,
              "droppedAttributesCount": 0
            }]
          }]
        }]
      }

sinks:
  logwiz:
    type: opentelemetry
    inputs: [to_otlp]
    protocol:
      type: http
      uri: ${origin}${OTLP_LOGS_INGEST_PATH}
      method: post
      encoding:
        codec: otlp
      compression: gzip
      request:
        headers:
          Authorization: "Bearer ${token}"
      batch:
        timeout_secs: 1
        max_bytes: 8388608`;

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
