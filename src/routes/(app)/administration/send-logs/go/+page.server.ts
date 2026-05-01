import { otelEnv } from '$lib/server/send-logs';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const INIT_COMMAND = 'go mod init example.com/logwiz-demo';

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
	logger.Info("Hello from Go to Logwiz")
}`;

const [initSnippet, getSnippet, exampleSnippet] = await Promise.all([
	snippet(INIT_COMMAND, 'bash'),
	snippet(GET_COMMAND, 'bash'),
	snippet(EXAMPLE_CODE, 'go')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	return {
		snippets: {
			init: initSnippet,
			get: getSnippet,
			envVars: await snippet(otelEnv({ origin, token, serviceName: 'my-go-service' }), 'bash'),
			example: exampleSnippet
		}
	};
};
