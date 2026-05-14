import { vectorOtlpSink } from '$lib/server/send-logs';
import { type CodeSnippet, snippet } from '$lib/server/syntax';
import type { CaddyLogFlavor } from '$lib/types';

import type { PageServerLoad } from './$types';

// ---------- Bare-metal flavor static snippets ----------

const BARE_CADDYFILE = `# Global block — Caddy runtime errors
{
    log default {
        output file /var/log/caddy/error.log
    }
}

# Per-site — JSON access log
example.com {
    log {
        output file /var/log/caddy/access.log
    }
    # ... rest of the site config
}`;

const BARE_RELOAD_CADDY_COMMAND = 'sudo systemctl reload caddy';
const BARE_GROUP_ADD_COMMAND = 'sudo usermod -aG caddy vector';
const BARE_RESTART_COMMAND = `sudo systemctl restart vector
sudo systemctl status vector`;
const BARE_TEST_COMMAND = 'curl -i http://localhost/';

// ---------- Docker flavor static snippets ----------

const DOCKER_CADDYFILE = `example.com {
    log {
        output stdout
    }
    # ... rest of the site config
}`;

const DOCKER_COMPOSE_FRAGMENT = `services:
  logwiz-vector:
    image: timberio/vector:0.54.0-alpine
    container_name: logwiz-vector
    restart: unless-stopped
    volumes:
      - ./vector.yaml:/etc/vector/vector.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro`;

const DOCKER_RUN_COMMAND = `docker compose up -d logwiz-vector

# If you changed the Caddyfile in step 1, also restart Caddy:
docker compose restart <your-caddy-service-name>`;

const DOCKER_TEST_COMMAND = 'curl -i http://localhost/';

// ---------- Pre-highlight static snippets in parallel ----------

const [
	bareCaddyfileSnippet,
	bareReloadCaddySnippet,
	bareGroupAddSnippet,
	bareRestartSnippet,
	bareTestSnippet,
	dockerCaddyfileSnippet,
	dockerComposeSnippet,
	dockerRunSnippet,
	dockerTestSnippet
] = await Promise.all([
	snippet(BARE_CADDYFILE, 'text'),
	snippet(BARE_RELOAD_CADDY_COMMAND, 'bash'),
	snippet(BARE_GROUP_ADD_COMMAND, 'bash'),
	snippet(BARE_RESTART_COMMAND, 'bash'),
	snippet(BARE_TEST_COMMAND, 'bash'),
	snippet(DOCKER_CADDYFILE, 'text'),
	snippet(DOCKER_COMPOSE_FRAGMENT, 'yaml'),
	snippet(DOCKER_RUN_COMMAND, 'bash'),
	snippet(DOCKER_TEST_COMMAND, 'bash')
]);

// ---------- Per-flavor snippet bundle types ----------

type BareMetalSnippets = {
	caddyfile: CodeSnippet;
	reloadCaddy: CodeSnippet;
	vectorConfig: CodeSnippet;
	groupAdd: CodeSnippet;
	restart: CodeSnippet;
	test: CodeSnippet;
};

type DockerSnippets = {
	caddyfile: CodeSnippet;
	compose: CodeSnippet;
	vectorConfig: CodeSnippet;
	run: CodeSnippet;
	test: CodeSnippet;
};

type FlavorBundles = {
	[F in CaddyLogFlavor]: F extends 'bare-metal' ? BareMetalSnippets : DockerSnippets;
};

// ---------- Vector config builders ----------

function buildBareMetalVectorConfig({ origin, token }: { origin: string; token: string }): string {
	return `sources:
  caddy_logs:
    type: file
    include:
      - /var/log/caddy/access.log
      - /var/log/caddy/error.log
    read_from: end

transforms:
  parse_caddy:
    type: remap
    inputs: [caddy_logs]
    source: |
      parsed, err = parse_json(.message)
      if err == null && is_object(parsed) {
        . = merge(., object!(parsed))
      }

      level = downcase(string(.level) ?? "info")
      if level == "debug" {
        .severity_number = 5
        .severity_text   = "DEBUG"
      } else if level == "info" {
        .severity_number = 9
        .severity_text   = "INFO"
      } else if level == "warn" {
        .severity_number = 13
        .severity_text   = "WARN"
      } else if level == "error" {
        .severity_number = 17
        .severity_text   = "ERROR"
      } else if level == "panic" || level == "fatal" {
        .severity_number = 21
        .severity_text   = "FATAL"
      } else {
        .severity_number = 9
        .severity_text   = "INFO"
      }

  to_otlp:
    type: remap
    inputs: [parse_caddy]
    source: |
      msg       = string(.msg) ?? string(.message) ?? ""
      file_path = string(.file) ?? ""

      ts_nano = to_unix_timestamp!(now(), unit: "nanoseconds")
      ts_float, ts_err = to_float(.ts)
      if ts_err == null {
        ts_nano = to_int(ts_float * 1000000000.0)
      }

      sev_num  = to_int(.severity_number) ?? 9
      sev_text = string(.severity_text)   ?? "INFO"

      attrs = [
        { "key": "log.file.path", "value": { "stringValue": file_path } }
      ]
      if exists(.logger) {
        attrs = push(attrs, { "key": "caddy.logger", "value": { "stringValue": string!(.logger) } })
      }

      if exists(.request) {
        if exists(.request.method) {
          attrs = push(attrs, { "key": "http.request.method", "value": { "stringValue": string!(.request.method) } })
        }
        if exists(.request.uri) {
          attrs = push(attrs, { "key": "url.path", "value": { "stringValue": string!(.request.uri) } })
        }
        if exists(.request.host) {
          attrs = push(attrs, { "key": "server.address", "value": { "stringValue": string!(.request.host) } })
        }
        if exists(.request.remote_ip) {
          attrs = push(attrs, { "key": "client.address", "value": { "stringValue": string!(.request.remote_ip) } })
        }
        if exists(.request.remote_port) {
          port_int, port_err = to_int(.request.remote_port)
          if port_err == null {
            attrs = push(attrs, { "key": "client.port", "value": { "intValue": port_int } })
          }
        }
        if exists(.request.proto) {
          parts = split(string!(.request.proto), "/")
          if length(parts) == 2 {
            proto_name = downcase(string!(parts[0]))
            proto_version = string!(parts[1])
            attrs = push(attrs, { "key": "network.protocol.name",    "value": { "stringValue": proto_name } })
            attrs = push(attrs, { "key": "network.protocol.version", "value": { "stringValue": proto_version } })
          }
        }
        ua = .request.headers."User-Agent"
        if is_array(ua) && length!(ua) > 0 {
          attrs = push(attrs, { "key": "user_agent.original", "value": { "stringValue": string!(ua[0]) } })
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
      }

      . = {
        "resourceLogs": [{
          "resource": {
            "attributes": [
              { "key": "service.name", "value": { "stringValue": "caddy" } },
              { "key": "host.name",    "value": { "stringValue": get_hostname!() } }
            ]
          },
          "scopeLogs": [{
            "scope": { "name": "vector", "version": "" },
            "logRecords": [{
              "timeUnixNano":         ts_nano,
              "observedTimeUnixNano": to_unix_timestamp!(now(), unit: "nanoseconds"),
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

${vectorOtlpSink({ origin, token })}`;
}

function buildDockerVectorConfig({ origin, token }: { origin: string; token: string }): string {
	return `sources:
  caddy:
    type: docker_logs
    include_containers:
      - caddy

transforms:
  parse_caddy:
    type: remap
    inputs: [caddy]
    source: |
      parsed, err = parse_json(.message)
      if err == null && is_object(parsed) {
        . = merge(., object!(parsed))
      }

      level = downcase(string(.level) ?? "info")
      if level == "debug" {
        .severity_number = 5
        .severity_text   = "DEBUG"
      } else if level == "info" {
        .severity_number = 9
        .severity_text   = "INFO"
      } else if level == "warn" {
        .severity_number = 13
        .severity_text   = "WARN"
      } else if level == "error" {
        .severity_number = 17
        .severity_text   = "ERROR"
      } else if level == "panic" || level == "fatal" {
        .severity_number = 21
        .severity_text   = "FATAL"
      } else {
        .severity_number = 9
        .severity_text   = "INFO"
      }

  to_otlp:
    type: remap
    inputs: [parse_caddy]
    source: |
      msg = string(.msg) ?? string(.message) ?? ""

      ts_nano = to_unix_timestamp!(now(), unit: "nanoseconds")
      ts_float, ts_err = to_float(.ts)
      if ts_err == null {
        ts_nano = to_int(ts_float * 1000000000.0)
      }

      sev_num  = to_int(.severity_number) ?? 9
      sev_text = string(.severity_text)   ?? "INFO"

      attrs = [
        { "key": "container.runtime", "value": { "stringValue": "docker" } }
      ]
      if exists(.container_id) {
        attrs = push(attrs, { "key": "container.id", "value": { "stringValue": string!(.container_id) } })
      }
      if exists(.container_name) {
        cname = replace(string!(.container_name), r'^/', "")
        attrs = push(attrs, { "key": "container.name", "value": { "stringValue": cname } })
      }
      if exists(.image) {
        attrs = push(attrs, { "key": "container.image.name", "value": { "stringValue": string!(.image) } })
      }
      if exists(.stream) {
        attrs = push(attrs, { "key": "log.iostream", "value": { "stringValue": string!(.stream) } })
      }
      if exists(.logger) {
        attrs = push(attrs, { "key": "caddy.logger", "value": { "stringValue": string!(.logger) } })
      }

      if exists(.request) {
        if exists(.request.method) {
          attrs = push(attrs, { "key": "http.request.method", "value": { "stringValue": string!(.request.method) } })
        }
        if exists(.request.uri) {
          attrs = push(attrs, { "key": "url.path", "value": { "stringValue": string!(.request.uri) } })
        }
        if exists(.request.host) {
          attrs = push(attrs, { "key": "server.address", "value": { "stringValue": string!(.request.host) } })
        }
        if exists(.request.remote_ip) {
          attrs = push(attrs, { "key": "client.address", "value": { "stringValue": string!(.request.remote_ip) } })
        }
        if exists(.request.remote_port) {
          port_int, port_err = to_int(.request.remote_port)
          if port_err == null {
            attrs = push(attrs, { "key": "client.port", "value": { "intValue": port_int } })
          }
        }
        if exists(.request.proto) {
          parts = split(string!(.request.proto), "/")
          if length(parts) == 2 {
            proto_name = downcase(string!(parts[0]))
            proto_version = string!(parts[1])
            attrs = push(attrs, { "key": "network.protocol.name",    "value": { "stringValue": proto_name } })
            attrs = push(attrs, { "key": "network.protocol.version", "value": { "stringValue": proto_version } })
          }
        }
        ua = .request.headers."User-Agent"
        if is_array(ua) && length!(ua) > 0 {
          attrs = push(attrs, { "key": "user_agent.original", "value": { "stringValue": string!(ua[0]) } })
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
      }

      . = {
        "resourceLogs": [{
          "resource": {
            "attributes": [
              { "key": "service.name", "value": { "stringValue": "caddy" } },
              { "key": "host.name",    "value": { "stringValue": get_hostname!() } }
            ]
          },
          "scopeLogs": [{
            "scope": { "name": "vector", "version": "" },
            "logRecords": [{
              "timeUnixNano":         ts_nano,
              "observedTimeUnixNano": to_unix_timestamp!(now(), unit: "nanoseconds"),
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

${vectorOtlpSink({ origin, token })}`;
}

// ---------- Load ----------

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const [bareVectorSnippet, dockerVectorSnippet] = await Promise.all([
		snippet(buildBareMetalVectorConfig({ origin, token }), 'yaml'),
		snippet(buildDockerVectorConfig({ origin, token }), 'yaml')
	]);

	const flavors: FlavorBundles = {
		'bare-metal': {
			caddyfile: bareCaddyfileSnippet,
			reloadCaddy: bareReloadCaddySnippet,
			vectorConfig: bareVectorSnippet,
			groupAdd: bareGroupAddSnippet,
			restart: bareRestartSnippet,
			test: bareTestSnippet
		},
		docker: {
			caddyfile: dockerCaddyfileSnippet,
			compose: dockerComposeSnippet,
			vectorConfig: dockerVectorSnippet,
			run: dockerRunSnippet,
			test: dockerTestSnippet
		}
	};

	return { flavors };
};
