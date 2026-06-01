import GoIcon from '@iconify-svelte/logos/go';
import { otelEnvVarsSnippet } from './_shared';
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
	logger.Info("Hello from Go to rootprint")
}`;

export const go: Integration = {
	id: 'go',
	label: 'Go',
	icon: GoIcon,
	category: 'Languages',
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
			callout: {
				variant: 'warning',
				html:
					'The <code>%20</code> after <code>Bearer</code> is required — OTLP expects ' +
					'URL-encoded header values.'
			}
		},
		{
			title: 'Send your first log',
			body: 'Save this to main.go and run `go run .`',
			snippets: [{ code: EXAMPLE_CODE, lang: 'go', copyTitle: 'Copy example' }],
			verify: {
				label: 'Open Search',
				href: `/?index=${encodeURIComponent(ctx.indexId)}`
			}
		}
	]
};
