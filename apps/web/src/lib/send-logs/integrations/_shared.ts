import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { tokenSubstring } from '../snippet-utils';
import type { IntegrationContext, Snippet } from '../types';

export function otelEnvVarsSnippet({
	ctx,
	serviceName,
	includeProtocol = false
}: {
	ctx: IntegrationContext;
	serviceName: string;
	includeProtocol?: boolean;
}): Snippet {
	const tokenFragment = tokenSubstring(ctx.token, ctx.hasRealToken);
	const lines = [`export OTEL_SERVICE_NAME=${serviceName}`];
	if (includeProtocol) lines.push('export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf');
	lines.push(
		`export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${ctx.origin}${OTLP_LOGS_INGEST_PATH}`,
		`export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${tokenFragment}`
	);
	return { code: lines.join('\n'), lang: 'bash', copyTitle: 'Copy environment variables' };
}

export function vectorOtlpSinkSnippet({
	ctx,
	inputs
}: {
	ctx: IntegrationContext;
	inputs: string;
}): string {
	const tokenFragment = tokenSubstring(ctx.token, ctx.hasRealToken);
	return `sinks:
  logwiz:
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
          Authorization: "Bearer ${tokenFragment}"`;
}
