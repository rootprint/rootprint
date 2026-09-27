import { OTLP_LOGS_INGEST_PATH, OTLP_TRACES_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import type { Callout, IntegrationContext, Signal, Snippet } from '../types';

export const BEARER_CALLOUT: Callout = {
	variant: 'warning',
	html:
		'Keep the <code>%20</code> after <code>Bearer</code>: OTLP exporters URL-decode header ' +
		'variables, and a literal space breaks the unquoted <code>export</code> line.'
};

/**
 * Closes a language Traces tab: a log row opens its trace only when the service ships both.
 * `caveat` is the language's trap that would leave rows unpaired or doubled.
 */
export function correlationCallout(caveat = ''): Callout {
	return {
		variant: 'info',
		html:
			'Ship this service’s logs too (the <a href="?signal=logs" class="link">Logs tab</a> ' +
			'shows how). rootprint pairs logs and spans by <code>trace_id</code>, so you can open ' +
			'the trace from any log written inside a span.' +
			(caveat && ` ${caveat}`)
	};
}

export function otelEnvVarsSnippet({
	ctx,
	serviceName,
	includeProtocol = false,
	signal = 'logs',
	disableOtherSignals = false
}: {
	ctx: IntegrationContext;
	serviceName: string;
	includeProtocol?: boolean;
	signal?: Signal;
	/** Zero-code runtimes default every signal to `otlp`; the unset ones then retry localhost:4318 forever. */
	disableOtherSignals?: boolean;
}): Snippet {
	const lines = [`export OTEL_SERVICE_NAME=${serviceName}`];
	if (includeProtocol) lines.push('export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf');
	if (signal === 'traces') {
		lines.push(
			`export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${ctx.origin}${OTLP_TRACES_INGEST_PATH}`,
			`export OTEL_EXPORTER_OTLP_TRACES_HEADERS=Authorization=Bearer%20${ctx.apiKey}`
		);
		if (disableOtherSignals) {
			lines.push('export OTEL_METRICS_EXPORTER=none', 'export OTEL_LOGS_EXPORTER=none');
		}
	} else {
		lines.push(
			`export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${ctx.origin}${OTLP_LOGS_INGEST_PATH}`,
			`export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${ctx.apiKey}`
		);
	}
	return {
		code: lines.join('\n'),
		lang: 'bash',
		copyTitle: 'Copy environment variables',
		highlightValue: highlightKey(ctx)
	};
}

/**
 * Vector's `otlp` codec drops any event not already shaped as OTLP, so a remap builds the
 * `resourceLogs` envelope before the sink.
 */
export function vectorOtlpSnippet({
	ctx,
	inputs,
	serviceName,
	attribute: [attributeKey, attributeExpr]
}: {
	ctx: IntegrationContext;
	inputs: string;
	/** VRL expression for `service.name`. */
	serviceName: string;
	/** A log-record attribute: its key and the VRL expression that fills it. */
	attribute: [string, string];
}): string {
	return `transforms:
  to_otlp:
    type: remap
    inputs: [${inputs}]
    source: |
      .resourceLogs = [{
        "resource": { "attributes": [
          { "key": "service.name", "value": { "stringValue": ${serviceName} } }
        ]},
        "scopeLogs": [{ "logRecords": [{
          "timeUnixNano": to_unix_timestamp(timestamp(.timestamp) ?? now(), unit: "nanoseconds"),
          "body": { "stringValue": string(.message) ?? "" },
          "attributes": [{ "key": "${attributeKey}", "value": { "stringValue": string(${attributeExpr}) ?? "" } }]
        }]}]
      }]

sinks:
  rootprint:
    type: opentelemetry
    inputs: [to_otlp]
    protocol:
      type: http
      uri: ${ctx.origin}${OTLP_LOGS_INGEST_PATH}
      method: post
      encoding:
        codec: otlp
      compression: gzip
      request:
        headers:
          Authorization: "Bearer ${ctx.apiKey}"`;
}
