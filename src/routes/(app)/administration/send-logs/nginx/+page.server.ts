import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const GROUP_ADD_COMMAND = 'sudo usermod -aG adm vector';

const RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;

const TEST_COMMAND = 'curl -i http://localhost/';

const GROUP_ADD_SNIPPET = {
	code: GROUP_ADD_COMMAND,
	html: await highlightCode(GROUP_ADD_COMMAND, 'bash'),
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

	const vectorConfig = `sources:
  nginx_logs:
    type: file
    include:
      - /var/log/nginx/access.log
      - /var/log/nginx/error.log
    read_from: end

transforms:
  parse_nginx:
    type: remap
    inputs: [nginx_logs]
    source: |
      parsed, err = parse_nginx_log(.message, format: "combined")
      if err != null {
        parsed, err = parse_nginx_log(.message, format: "error")
      }
      if err == null && is_object(parsed) {
        . = merge(., object(parsed))
        .nginx_format = if exists(.severity) { "error" } else { "access" }
      }

      if .nginx_format == "error" {
        sev = downcase(string(.severity) ?? "info")
        if sev == "debug" {
          .severity_number = 5
          .severity_text   = "DEBUG"
        } else if sev == "info" {
          .severity_number = 9
          .severity_text   = "INFO"
        } else if sev == "notice" {
          .severity_number = 10
          .severity_text   = "NOTICE"
        } else if sev == "warn" {
          .severity_number = 13
          .severity_text   = "WARN"
        } else if sev == "error" {
          .severity_number = 17
          .severity_text   = "ERROR"
        } else if sev == "crit" {
          .severity_number = 19
          .severity_text   = "CRIT"
        } else if sev == "alert" {
          .severity_number = 21
          .severity_text   = "ALERT"
        } else if sev == "emerg" {
          .severity_number = 23
          .severity_text   = "EMERG"
        } else {
          .severity_number = 9
          .severity_text   = "INFO"
        }
      } else {
        .severity_number = 9
        .severity_text   = "INFO"
      }

  to_otlp:
    type: remap
    inputs: [parse_nginx]
    source: |
      msg       = string(.message) ?? ""
      file_path = string(.file) ?? ""
      fmt       = string(.nginx_format) ?? "access"

      ts_nano = to_unix_timestamp(now(), unit: "nanoseconds")
      if exists(.timestamp) && is_timestamp(.timestamp) {
        ts_nano = to_unix_timestamp!(.timestamp, unit: "nanoseconds")
      }

      sev_num  = to_int(.severity_number) ?? 9
      sev_text = string(.severity_text)   ?? "INFO"

      attrs = [
        { "key": "log.file.path",  "value": { "stringValue": file_path } },
        { "key": "nginx.format",   "value": { "stringValue": fmt } }
      ]

      if fmt == "access" {
        if exists(.request) {
          req_str = string!(.request)
          if req_str != "" && req_str != "-" {
            request_parts = split(req_str, " ")
            if length(request_parts) >= 1 {
              attrs = push(attrs, { "key": "http.request.method", "value": { "stringValue": request_parts[0] } })
            }
            if length(request_parts) >= 2 {
              attrs = push(attrs, { "key": "url.path", "value": { "stringValue": request_parts[1] } })
            }
            if length(request_parts) >= 3 {
              proto_parts = split!(request_parts[2], "/")
              if length(proto_parts) == 2 {
                attrs = push(attrs, { "key": "network.protocol.name",    "value": { "stringValue": downcase!(proto_parts[0]) } })
                attrs = push(attrs, { "key": "network.protocol.version", "value": { "stringValue": proto_parts[1] } })
              }
            }
          }
        }
        if exists(.status) {
          status_int, status_err = to_int(.status)
          if status_err == null {
            attrs = push(attrs, { "key": "http.response.status_code", "value": { "intValue": status_int } })
          }
        }
        if exists(.size) {
          size_int, size_err = to_int(.size)
          if size_err == null {
            attrs = push(attrs, { "key": "http.response.body.size", "value": { "intValue": size_int } })
          }
        }
        if exists(.client) {
          attrs = push(attrs, { "key": "client.address", "value": { "stringValue": string!(.client) } })
        }
        if exists(.agent) && string!(.agent) != "-" {
          attrs = push(attrs, { "key": "user_agent.original", "value": { "stringValue": string!(.agent) } })
        }
        if exists(.referer) && string!(.referer) != "-" {
          attrs = push(attrs, { "key": "http.request.header.referer", "value": { "stringValue": string!(.referer) } })
        }
        if exists(.user) && string!(.user) != "-" {
          attrs = push(attrs, { "key": "enduser.id", "value": { "stringValue": string!(.user) } })
        }
      } else {
        if exists(.pid) {
          pid_int, pid_err = to_int(.pid)
          if pid_err == null {
            attrs = push(attrs, { "key": "process.pid", "value": { "intValue": pid_int } })
          }
        }
        if exists(.tid) {
          tid_int, tid_err = to_int(.tid)
          if tid_err == null {
            attrs = push(attrs, { "key": "thread.id", "value": { "intValue": tid_int } })
          }
        }
        if exists(.cid) {
          cid_int, cid_err = to_int(.cid)
          if cid_err == null {
            attrs = push(attrs, { "key": "nginx.connection_id", "value": { "intValue": cid_int } })
          }
        }
        if exists(.client) {
          attrs = push(attrs, { "key": "client.address", "value": { "stringValue": string!(.client) } })
        }
        if exists(.host) {
          attrs = push(attrs, { "key": "server.address", "value": { "stringValue": string!(.host) } })
        }
        if exists(.server) {
          attrs = push(attrs, { "key": "nginx.server", "value": { "stringValue": string!(.server) } })
        }
        if exists(.upstream) {
          attrs = push(attrs, { "key": "nginx.upstream", "value": { "stringValue": string!(.upstream) } })
        }
      }

      . = {
        "resourceLogs": [{
          "resource": {
            "attributes": [
              { "key": "service.name", "value": { "stringValue": "nginx" } },
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
			vectorConfig: {
				code: vectorConfig,
				html: await highlightCode(vectorConfig, 'yaml'),
				lang: 'yaml'
			},
			groupAdd: GROUP_ADD_SNIPPET,
			restart: RESTART_SNIPPET,
			test: TEST_SNIPPET
		}
	};
};
