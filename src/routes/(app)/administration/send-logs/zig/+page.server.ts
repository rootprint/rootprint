import { otelEnv } from '$lib/server/send-logs';
import { snippet } from '$lib/server/syntax';

import type { PageServerLoad } from './$types';

const FETCH_COMMAND = `zig fetch --save "git+https://github.com/zig-o11y/opentelemetry-sdk#v0.1.1"`;

const BUILD_ZIG_SNIPPET = `const otel_sdk = b.dependency("opentelemetry", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("opentelemetry-sdk", otel_sdk.module("sdk"));`;

const EXAMPLE_CODE = `const std = @import("std");
const sdk = @import("opentelemetry-sdk");

pub const std_options: std.Options = .{
    .logFn = sdk.logs.std_log_bridge.logFn,
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // OTLP exporter — reads OTEL_EXPORTER_OTLP_* env vars
    var otlp_config = try sdk.otlp.ConfigOptions.init(allocator);
    defer otlp_config.deinit();

    var otlp_exporter = try sdk.logs.OTLPExporter.init(allocator, otlp_config);
    defer otlp_exporter.deinit();
    const exporter = otlp_exporter.asLogRecordExporter();

    // Wire the exporter into a processor
    var simple_processor = sdk.logs.SimpleLogRecordProcessor.init(allocator, exporter);
    const processor = simple_processor.asLogRecordProcessor();

    // Logger provider with the processor attached
    var provider = try sdk.logs.LoggerProvider.init(allocator, null);
    defer provider.deinit();
    try provider.addLogRecordProcessor(processor);

    // Route std.log calls through OpenTelemetry
    try sdk.logs.std_log_bridge.configure(.{
        .provider = provider,
        .also_log_to_stderr = true,
    });
    defer sdk.logs.std_log_bridge.shutdown();

    std.log.info("Hello from Zig to Logwiz", .{});

    try provider.shutdown();
}`;

const [fetchSnippet, buildSnippet, exampleSnippet] = await Promise.all([
	snippet(FETCH_COMMAND, 'bash'),
	snippet(BUILD_ZIG_SNIPPET, 'zig'),
	snippet(EXAMPLE_CODE, 'zig')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	return {
		snippets: {
			fetch: fetchSnippet,
			build: buildSnippet,
			envVars: await snippet(otelEnv({ origin, token, serviceName: 'my-zig-service' }), 'bash'),
			example: exampleSnippet
		}
	};
};
