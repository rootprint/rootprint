import GoIcon from '@iconify-svelte/logos/go';
import { BEARER_CALLOUT, correlationCallout, otelEnvVarsSnippet } from './_shared';
import type { Integration } from '../types';

const INIT_COMMAND = 'go mod init example.com/rootprint-demo';

const GET_COMMAND = `go get go.opentelemetry.io/otel \\
    go.opentelemetry.io/otel/log \\
    go.opentelemetry.io/otel/sdk/log \\
    go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp \\
    go.opentelemetry.io/contrib/bridges/otelslog`;

const EXAMPLE_CODE = `package main

import (
	"context"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

func main() {
	ctx := context.Background()
	exporter, err := otlploghttp.New(ctx)
	if err != nil {
		panic(err)
	}
	provider := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	defer provider.Shutdown(ctx)
	global.SetLoggerProvider(provider)

	logger := otelslog.NewLogger("hello")
	// Pass the request's ctx in real code: the record takes its trace_id from it.
	logger.InfoContext(ctx, "Hello from Go to rootprint")
}`;

const TRACES_GET_COMMAND = `go get go.opentelemetry.io/otel \\
    go.opentelemetry.io/otel/sdk/trace \\
    go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp`;

const TRACES_EXAMPLE_CODE = `package main

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func main() {
	ctx := context.Background()
	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		panic(err)
	}
	provider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
	defer provider.Shutdown(ctx)
	otel.SetTracerProvider(provider)

	_, span := otel.Tracer("hello").Start(ctx, "hello-from-go")
	span.End()
}`;

export const go: Integration = {
	id: 'go',
	label: 'Go',
	icon: GoIcon,
	origin: 'Application',
	docs: 'https://docs.rootprint.io/send-logs/languages/go',
	logs: {
		buildSteps: (ctx) => [
			{
				title: 'Install the OpenTelemetry SDK',
				body:
					'Initialize a module if you do not already have one, then add the OpenTelemetry ' +
					'SDK with the HTTP/protobuf log exporter and the slog bridge.',
				snippets: [
					{ code: INIT_COMMAND, lang: 'bash', copyTitle: 'Copy init command' },
					{ code: GET_COMMAND, lang: 'bash', copyTitle: 'Copy get command' }
				]
			},
			{
				title: 'Set environment variables',
				body: 'The exporter reads these automatically — no code changes needed per service.',
				snippets: [otelEnvVarsSnippet({ ctx, serviceName: 'my-go-service' })],
				callout: BEARER_CALLOUT
			},
			{
				title: 'Send your first log',
				body: 'Save this to main.go and run `go run .`',
				snippets: [{ code: EXAMPLE_CODE, lang: 'go', copyTitle: 'Copy example' }]
			}
		]
	},
	traces: {
		buildSteps: (ctx) => [
			{
				title: 'Install the OpenTelemetry SDK',
				body:
					'Initialize a module if you do not already have one, then add the SDK with the ' +
					'HTTP/protobuf trace exporter. Go has no stable zero-code agent, so the provider is ' +
					'wired up in code.',
				snippets: [
					{ code: INIT_COMMAND, lang: 'bash', copyTitle: 'Copy init command' },
					{ code: TRACES_GET_COMMAND, lang: 'bash', copyTitle: 'Copy get command' }
				]
			},
			{
				title: 'Set environment variables',
				body: 'The exporter reads these automatically — no code changes needed per service.',
				snippets: [otelEnvVarsSnippet({ ctx, serviceName: 'my-go-service', signal: 'traces' })],
				callout: BEARER_CALLOUT
			},
			{
				title: 'Send your first span',
				body:
					'Save this to main.go and run `go run .`; Shutdown flushes the batch before the ' +
					'process exits. Then instrument your app with otelhttp and otelgrpc from ' +
					'go.opentelemetry.io/contrib.',
				snippets: [{ code: TRACES_EXAMPLE_CODE, lang: 'go', copyTitle: 'Copy example' }],
				callout: correlationCallout(
					'Log with <code>InfoContext(ctx, …)</code>: a call without the request’s context ' +
						'carries no span.'
				)
			}
		]
	}
};
