import { vectorOtlpSink } from '$lib/server/send-logs';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = `sudo mkdir -p /var/log/myapp
echo "$(date -Iseconds) hello from vector" | sudo tee -a /var/log/myapp/test.log`;

const [restartSnippet, testSnippet] = await Promise.all([
	snippet(RESTART_COMMAND, 'bash'),
	snippet(TEST_COMMAND, 'bash')
]);

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

${vectorOtlpSink({ origin, token })}`;

	return {
		snippets: {
			vectorConfig: await snippet(vectorConfig, 'yaml'),
			restart: restartSnippet,
			test: testSnippet
		}
	};
};
