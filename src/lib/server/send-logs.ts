import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';

type OtelEnvOptions = {
	origin: string;
	token: string;
	serviceName: string;
	includeProtocol?: boolean;
};

export function otelEnv({
	origin,
	token,
	serviceName,
	includeProtocol = false
}: OtelEnvOptions): string {
	const lines = [`export OTEL_SERVICE_NAME=${serviceName}`];
	if (includeProtocol) lines.push('export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf');
	lines.push(
		`export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}`,
		`export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`
	);
	return lines.join('\n');
}

type VectorOtlpSinkOptions = {
	origin: string;
	token: string;
	inputs?: string;
};

export function vectorOtlpSink({
	origin,
	token,
	inputs = 'to_otlp'
}: VectorOtlpSinkOptions): string {
	return `sinks:
  logwiz:
    type: opentelemetry
    inputs: [${inputs}]
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
}
