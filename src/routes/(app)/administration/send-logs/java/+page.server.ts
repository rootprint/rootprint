import { OTLP_LOGS_INGEST_PATH } from '$lib/constants/defaults';
import { highlightCode } from '$lib/server/syntax';
import type { JavaLogFlavor } from '$lib/types';

import type { PageServerLoad } from './$types';

const AGENT_INSTALL =
	'curl -LO https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar';

const AGENT_EXAMPLE = `import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class App {
	private static final Logger log = LoggerFactory.getLogger(App.class);

	public static void main(String[] args) {
		log.info("Hello from Java to Logwiz");
	}
}`;

const SDK_INSTALL = `dependencies {
	implementation("io.opentelemetry:opentelemetry-api:1.61.0")
	implementation("io.opentelemetry:opentelemetry-sdk-extension-autoconfigure:1.61.0")
	implementation("io.opentelemetry:opentelemetry-exporter-otlp:1.61.0")
}`;

const SDK_EXAMPLE = `import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.sdk.autoconfigure.AutoConfiguredOpenTelemetrySdk;

public class App {
	public static void main(String[] args) {
		var sdk = AutoConfiguredOpenTelemetrySdk.initialize().getOpenTelemetrySdk();
		Logger logger = sdk.getLogsBridge().get("hello");
		logger.logRecordBuilder()
			.setSeverity(Severity.INFO)
			.setBody("Hello from Java to Logwiz")
			.emit();
		sdk.getSdkLoggerProvider().shutdown();
	}
}`;

type FlavorSnippets = {
	install: { code: string; html: string; lang: string };
	example: { code: string; html: string; lang: string };
	envVars: { code: string; html: string; lang: string };
};

const [agentInstallHtml, agentExampleHtml, sdkInstallHtml, sdkExampleHtml] = await Promise.all([
	highlightCode(AGENT_INSTALL, 'bash'),
	highlightCode(AGENT_EXAMPLE, 'java'),
	highlightCode(SDK_INSTALL, 'kotlin'),
	highlightCode(SDK_EXAMPLE, 'java')
]);

export const load: PageServerLoad = async ({ parent }) => {
	const { token, origin } = await parent();
	if (!token) return {};

	const baseEnv = `export OTEL_SERVICE_NAME=my-java-service
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=${origin}${OTLP_LOGS_INGEST_PATH}
export OTEL_EXPORTER_OTLP_LOGS_HEADERS=Authorization=Bearer%20${token}`;

	const agentEnv = `${baseEnv}
export JAVA_TOOL_OPTIONS="-javaagent:./opentelemetry-javaagent.jar"`;

	const [agentEnvHtml, sdkEnvHtml] = await Promise.all([
		highlightCode(agentEnv, 'bash'),
		highlightCode(baseEnv, 'bash')
	]);

	const flavors: Record<JavaLogFlavor, FlavorSnippets> = {
		agent: {
			install: { code: AGENT_INSTALL, html: agentInstallHtml, lang: 'bash' },
			example: { code: AGENT_EXAMPLE, html: agentExampleHtml, lang: 'java' },
			envVars: { code: agentEnv, html: agentEnvHtml, lang: 'bash' }
		},
		sdk: {
			install: { code: SDK_INSTALL, html: sdkInstallHtml, lang: 'kotlin' },
			example: { code: SDK_EXAMPLE, html: sdkExampleHtml, lang: 'java' },
			envVars: { code: baseEnv, html: sdkEnvHtml, lang: 'bash' }
		}
	};

	return { flavors };
};
