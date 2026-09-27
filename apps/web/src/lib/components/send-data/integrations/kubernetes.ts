import KubernetesIcon from '@iconify-svelte/logos/kubernetes';
import { OTLP_LOGS_INGEST_PATH } from '../constants';
import { highlightKey } from '../snippet-utils';
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
	origin: 'Infrastructure',
	docs: 'https://docs.rootprint.io/send-logs/platforms/kubernetes',
	logs: {
		buildSteps: (ctx) => {
			const values = `mode: daemonset

# The chart ships no default image; this distribution bundles every component used below.
image:
  repository: otel/opentelemetry-collector-k8s

presets:
  logsCollection:
    enabled: true
  kubernetesAttributes:
    enabled: true

config:
  processors:
    # Only fills in records with no severity, so OTLP logs keep the level their SDK set.
    transform:
      log_statements:
        - set(log.severity_number, SEVERITY_NUMBER_ERROR) where log.severity_number == SEVERITY_NUMBER_UNSPECIFIED and IsString(log.body) and IsMatch(log.body, "(?i)\\\\b(error|fatal|panic|exception)\\\\b")
        - set(log.severity_number, SEVERITY_NUMBER_WARN) where log.severity_number == SEVERITY_NUMBER_UNSPECIFIED and IsString(log.body) and IsMatch(log.body, "(?i)\\\\b(warn|warning|deprecated)\\\\b")
        - set(log.severity_number, SEVERITY_NUMBER_INFO) where log.severity_number == SEVERITY_NUMBER_UNSPECIFIED
        - set(log.severity_text, "ERROR") where log.severity_text == "" and log.severity_number == SEVERITY_NUMBER_ERROR
        - set(log.severity_text, "WARN") where log.severity_text == "" and log.severity_number == SEVERITY_NUMBER_WARN
        - set(log.severity_text, "INFO") where log.severity_text == "" and log.severity_number == SEVERITY_NUMBER_INFO
  exporters:
    otlp_http:
      logs_endpoint: ${ctx.origin}${OTLP_LOGS_INGEST_PATH}
      headers:
        Authorization: "Bearer ${ctx.apiKey}"
  service:
    pipelines:
      logs:
        # Helm replaces lists instead of merging them, so this repeats the chart's
        # memory_limiter/batch and the preset's k8s_attributes around transform.
        processors: [memory_limiter, k8s_attributes, transform, batch]
        exporters: [otlp_http]`;

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
						'This file includes your endpoint and ingest key. The kubernetesAttributes preset tags every ' +
						'record with pod, namespace, node, and container; the transform infers severity from the ' +
						'message body when a record has none.',
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
					snippets: [{ code: TEST_COMMAND, lang: 'bash', copyTitle: 'Copy test command' }]
				}
			];
		}
	}
};
