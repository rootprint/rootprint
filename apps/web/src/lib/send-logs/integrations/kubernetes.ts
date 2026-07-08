import KubernetesIcon from '@iconify-svelte/logos/kubernetes';
import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
import { searchVerifyLink } from './_shared';
import type { Integration } from '../types';

const ADD_REPO = `helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update`;

const INSTALL = `helm install rootprint-otel open-telemetry/opentelemetry-collector \\
  --namespace rootprint --create-namespace \\
  -f values.yaml`;

const TEST_COMMAND = `kubectl run rootprint-smoke-test --image=alpine --restart=Never \\
  -- echo "hello from rootprint"`;

export const kubernetes: Integration = {
	id: 'kubernetes',
	label: 'Kubernetes',
	icon: KubernetesIcon,
	origin: 'Containers',
	docs: 'https://docs.rootprint.io/send-logs/platforms/kubernetes',
	buildSteps: (ctx) => {
		const values = `mode: daemonset

presets:
  logsCollection:
    enabled: true
  kubernetesAttributes:
    enabled: true

config:
  processors:
    transform:
      log_statements:
        - context: log
          statements:
            - set(severity_number, SEVERITY_NUMBER_ERROR) where IsString(body) and IsMatch(body, "(?i)\\\\b(error|fatal|panic|exception)\\\\b")
            - set(severity_text, "ERROR") where severity_number == SEVERITY_NUMBER_ERROR
            - set(severity_number, SEVERITY_NUMBER_WARN) where severity_number == 0 and IsString(body) and IsMatch(body, "(?i)\\\\b(warn|warning|deprecated|retry)\\\\b")
            - set(severity_text, "WARN") where severity_number == SEVERITY_NUMBER_WARN
            - set(severity_number, SEVERITY_NUMBER_INFO) where severity_number == 0
            - set(severity_text, "INFO") where severity_text == ""
  exporters:
    otlphttp:
      logs_endpoint: ${ctx.origin}${OTLP_LOGS_INGEST_PATH}
      compression: gzip
      headers:
        Authorization: "Bearer ${ctx.apiKey}"
  service:
    pipelines:
      logs:
        # Listed in full because the chart replaces this array rather than merging it.
        # The presets add memory_limiter/k8sattributes/batch — keep them when slotting in transform.
        processors: [memory_limiter, k8sattributes, transform, batch]
        exporters: [otlphttp]`;

		return [
			{
				title: 'Add the OpenTelemetry Helm repo',
				body:
					'The Collector runs as a DaemonSet — one pod per node — tailing every pod’s ' +
					'stdout/stderr off the kubelet. Per-platform packaging is maintained upstream.',
				snippets: [{ code: ADD_REPO, lang: 'bash', copyTitle: 'Copy repo commands' }]
			},
			{
				title: 'Write values.yaml',
				body:
					'The endpoint and API key are prefilled. The kubernetesAttributes preset tags every ' +
					'record with pod, namespace, node, and container; the transform infers severity from the ' +
					'message body.',
				snippets: [
					{
						code: values,
						lang: 'yaml',
						copyTitle: 'Copy values.yaml',
						highlightValue: highlightKey(ctx)
					}
				],
				callout: {
					variant: 'info',
					html:
						'Want cluster events (OOMKills, scheduling) or the attribute reference? See the ' +
						'<a href="https://docs.rootprint.io/send-logs/platforms/kubernetes" target="_blank" rel="noreferrer" class="link">Kubernetes docs</a>.'
				}
			},
			{
				title: 'Install the chart',
				body: 'Deploys the DaemonSet into a dedicated namespace.',
				snippets: [{ code: INSTALL, lang: 'bash', copyTitle: 'Copy install command' }]
			},
			{
				title: 'Send a test log',
				body:
					'Runs a one-off pod that prints a line and exits — the node’s Collector tails it and ships ' +
					'it within a few seconds. Clean up with `kubectl delete pod rootprint-smoke-test`.',
				snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }],
				verify: searchVerifyLink(ctx.indexId)
			}
		];
	}
};
