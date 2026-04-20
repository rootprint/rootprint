<script lang="ts">
	import { Search } from 'lucide-svelte';

	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Docker">
	<Callout variant="warning">
		<p>
			These instructions are Linux-only. They mount
			<InlineCode>/var/lib/docker/containers</InlineCode> and
			<InlineCode>/var/run/docker.sock</InlineCode> from the host, which works with Docker Engine on Linux.
			Docker Desktop on macOS and Windows runs Docker inside a VM, so those host paths are not available
			as shown.
		</p>
	</Callout>

	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Create the collector config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this as <InlineCode>otel-collector-config.yaml</InlineCode> next to your
						<InlineCode>docker-compose.yml</InlineCode>. The endpoint and token are prefilled.
					</p>
				</div>
				<CodeBlock {...data.snippets.collectorConfig} copyTitle="Copy collector config" />
				<Callout variant="info">
					<p>
						The <InlineCode>contrib</InlineCode> distribution is required — the
						<InlineCode>container</InlineCode> operator that parses Docker's per-line JSON log format
						ships only in <InlineCode>otel/opentelemetry-collector-contrib</InlineCode>, not the
						core image.
					</p>
				</Callout>
				<Callout variant="warning">
					<p>
						The <InlineCode>filter/exclude_self</InlineCode> processor drops logs from the collector itself.
						Without it, every line the collector emits would be tailed from its own log file and re-shipped
						— creating an amplification loop. The filter matches on
						<InlineCode>container.name == "otel-collector"</InlineCode>, which is why the compose
						service below pins <InlineCode>container_name: otel-collector</InlineCode>.
					</p>
				</Callout>
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Add the collector to your compose file</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Drop this service alongside your existing ones. No changes to your other services are
						needed — the collector reads every container's logs from the host.
					</p>
				</div>
				<CodeBlock {...data.snippets.compose} copyTitle="Copy compose fragment" />
				<Callout variant="warning">
					<p>
						Mounts are read-only. The Docker socket is used only to enrich logs with container names
						— the collector never issues write commands.
					</p>
				</Callout>
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Start the collector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Bring the sidecar up. Your other services keep running untouched.
					</p>
				</div>
				<CodeBlock {...data.snippets.run} copyTitle="Copy run command" />
			</SendLogsStep>

			<SendLogsStep number={4}>
				<div>
					<h3 class="font-semibold">Send a test log line</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Run a throwaway container that prints one line and exits. The collector picks the line
						up from the host log file, the <InlineCode>container</InlineCode> operator attaches
						<InlineCode>container.name=logwiz-smoke-test</InlineCode>, and the record is shipped to
						Logwiz.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<SendLogsStep number={5} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Open Search and filter on the message body
						<InlineCode>hello from logwiz</InlineCode> or the resource attribute
						<InlineCode>resource_attributes.container.name:logwiz-smoke-test</InlineCode>. The
						record typically arrives within ~5 seconds (the batch interval).
					</p>
				</div>
				<div>
					<a
						href="/?index={encodeURIComponent(DEFAULT_OTEL_LOGS_INDEX_ID)}"
						class="btn gap-2 btn-sm btn-accent"
					>
						<Search size={14} />
						Open Search
					</a>
				</div>
			</SendLogsStep>
		</ol>
	{/if}
</SendLogsSourceShell>
