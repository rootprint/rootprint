import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from vector" | sudo tee -a /var/log/myapp/test.log`;

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

	const vectorConfig = `sources:
  app_logs:
    type: file
    include:
      - /var/log/myapp/*.log
    read_from: end

transforms:
  to_otlp:
    type: remap
    inputs: [app_logs]
    source: |
      .resourceLogs = [{
        "resource": {
          "attributes": [
            { "key": "service.name", "value": { "stringValue": "myapp" } },
            { "key": "host.name", "value": { "stringValue": get_hostname!() } }
          ]
        },
        "scopeLogs": [{
          "scope": { "name": "vector", "version": "" },
          "logRecords": [{
            "timeUnixNano": to_unix_timestamp!(now(), unit: "nanoseconds"),
            "observedTimeUnixNano": to_unix_timestamp!(now(), unit: "nanoseconds"),
            "severityNumber": 9,
            "severityText": "INFO",
            "body": { "stringValue": .message },
            "attributes": [
              { "key": "log.file.path", "value": { "stringValue": .file } }
            ],
            "traceId": "",
            "spanId": "",
            "flags": 0,
            "droppedAttributesCount": 0
          }]
        }]
      }]

      del(.message)
      del(.file)
      del(.host)
      del(.source_type)
      del(.timestamp)

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
			vectorConfig: {
				code: vectorConfig,
				html: await highlightCode(vectorConfig, 'yaml'),
				lang: 'yaml'
			},
			restart: RESTART_SNIPPET,
			test: TEST_SNIPPET
		}
	};
};
