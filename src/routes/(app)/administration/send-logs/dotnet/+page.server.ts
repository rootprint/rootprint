import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';
import type { DotnetLogFlavor } from '$lib/types';

import type { PageServerLoad } from './$types';

const AUTO_INSTALL = `# Linux / macOS
curl -sSfL https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/latest/download/otel-dotnet-auto-install.sh -O
sh ./otel-dotnet-auto-install.sh

# Windows (PowerShell)
# Invoke-WebRequest -Uri "https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/latest/download/OpenTelemetry.DotNet.Auto.psm1" -OutFile "OpenTelemetry.DotNet.Auto.psm1"
# Import-Module "./OpenTelemetry.DotNet.Auto.psm1"
# Install-OpenTelemetryCore`;

const AUTO_EXAMPLE = `using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);
using var host = builder.Build();

var logger = host.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Hello from .NET to Logwiz");`;

const SDK_INSTALL = `dotnet add package OpenTelemetry.Extensions.Hosting
dotnet add package OpenTelemetry.Exporter.OpenTelemetryProtocol`;

const SDK_EXAMPLE = `using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddOpenTelemetry().UseOtlpExporter();

using var host = builder.Build();
var logger = host.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Hello from .NET to Logwiz");`;

type FlavorSnippets = {
	install: { code: string; html: string; lang: string };
	example: { code: string; html: string; lang: string };
	envVars: { code: string; html: string; lang: string };
};

const [autoInstallHtml, autoExampleHtml, sdkInstallHtml, sdkExampleHtml] = await Promise.all([
	highlightCode(AUTO_INSTALL, 'bash'),
	highlightCode(AUTO_EXAMPLE, 'csharp'),
	highlightCode(SDK_INSTALL, 'bash'),
	highlightCode(SDK_EXAMPLE, 'csharp')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const baseEnv = `export OTEL_SERVICE_NAME=my-dotnet-service
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}
export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`;

	const autoEnv = `# Source the installer-generated script (Linux / macOS — bash/zsh)
. $HOME/.otel-dotnet-auto/instrument.sh

# Windows (PowerShell)
# . $HOME\\.otel-dotnet-auto\\instrument.ps1

${baseEnv}`;

	const [autoEnvHtml, sdkEnvHtml] = await Promise.all([
		highlightCode(autoEnv, 'bash'),
		highlightCode(baseEnv, 'bash')
	]);

	const flavors: Record<DotnetLogFlavor, FlavorSnippets> = {
		auto: {
			install: { code: AUTO_INSTALL, html: autoInstallHtml, lang: 'bash' },
			example: { code: AUTO_EXAMPLE, html: autoExampleHtml, lang: 'csharp' },
			envVars: { code: autoEnv, html: autoEnvHtml, lang: 'bash' }
		},
		sdk: {
			install: { code: SDK_INSTALL, html: sdkInstallHtml, lang: 'bash' },
			example: { code: SDK_EXAMPLE, html: sdkExampleHtml, lang: 'csharp' },
			envVars: { code: baseEnv, html: sdkEnvHtml, lang: 'bash' }
		}
	};

	return { flavors };
};
