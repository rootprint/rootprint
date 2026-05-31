import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { apiKeySubstring } from '../snippet-utils';
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
	const apiKeyFragment = apiKeySubstring(ctx.apiKey, ctx.hasRealApiKey);
	const lines = [`export OTEL_SERVICE_NAME=${serviceName}`];
	if (includeProtocol) lines.push('export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf');
	lines.push(
		`export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${ctx.origin}${OTLP_LOGS_INGEST_PATH}`,
		`export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${apiKeyFragment}`
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
	const apiKeyFragment = apiKeySubstring(ctx.apiKey, ctx.hasRealApiKey);
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
          Authorization: "Bearer ${apiKeyFragment}"`;
}
