import { OTLP_LOGS_INGEST_PATH, OTLP_TRACES_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import type { Callout, IntegrationContext, Signal, Snippet, Verify } from '../types';

/** The standard "did my logs arrive?" verify step: a link into Search scoped to the index. */
export function searchVerifyLink(indexId: string): Verify {
	return { label: 'Open Search', href: `/?index=${encodeURIComponent(indexId)}` };
}

export const BEARER_CALLOUT: Callout = {
	variant: 'warning',
	html:
		'The <code>%20</code> after <code>Bearer</code> is required — OTLP expects ' +
		'URL-encoded header values.'
};

/** Closes a language Traces tab: spans are only ever reached from a log, so say so. */
export const CORRELATION_CALLOUT: Callout = {
	variant: 'info',
	html:
		'Spans are reached from a log. Ship logs from this service too — see the ' +
		'<a href="?signal=logs" class="link">Logs tab</a> — and rootprint pairs the two by ' +
		'<code>trace_id</code>, so any log row opens its trace.'
};

/** The Collector and Kubernetes variant: one exporter, both signals. */
export const COLLECTOR_CORRELATION_CALLOUT: Callout = {
	variant: 'info',
	html:
		'One <code>otlphttp</code> exporter carries both signals — keep <code>logs_endpoint</code> ' +
		'and <code>traces_endpoint</code> side by side and declare both pipelines. The ' +
		'<a href="?signal=logs" class="link">Logs tab</a> has the logs half — pairing by ' +
		'<code>trace_id</code> works once the application’s own log records carry trace context ' +
		'(e.g. an OTel log appender), not for tailed stdout/file lines.'
};

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

export function vectorOtlpSinkSnippet({
	ctx,
	inputs
}: {
	ctx: IntegrationContext;
	inputs: string;
}): string {
	return `sinks:
  rootprint:
    type: opentelemetry
    inputs: [${inputs}]
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
