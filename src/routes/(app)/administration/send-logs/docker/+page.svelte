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
			<InlineCode>/var/lib/docker/containers</InlineCode> from the host, which works with Docker Engine
			on Linux. Docker Desktop on macOS and Windows runs Docker inside a VM, so that host path is not
			available as shown.
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
				<Callout variant="info">
					<p>
						The <InlineCode>container</InlineCode> operator does not emit
						<InlineCode>container.name</InlineCode> — only <InlineCode>log.iostream</InlineCode> and the
						parsed timestamp. <InlineCode>transform/enrich</InlineCode> extracts the 64-char container
						ID from the log file path into <InlineCode>container.id</InlineCode> and uses it as <InlineCode
							>service.name</InlineCode
						> when the app hasn't set one itself.
					</p>
				</Callout>
				<Callout variant="warning">
					<p>
						The <InlineCode>filter/exclude_self</InlineCode> processor drops logs from the collector itself
						— without it, every line the collector emits would be tailed and re-shipped, creating an amplification
						loop. The filter matches
						<InlineCode>{'${env:HOSTNAME}'}</InlineCode>, which Docker sets to the collector
						container's own short (12-char) ID, against the prefix of each record's
						<InlineCode>container.id</InlineCode>. If you set an explicit
						<InlineCode>hostname:</InlineCode> on the collector service, the match breaks — leave it unset
						or update the filter to your chosen value.
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
				<Callout variant="info">
					<p>
						Both mounts are read-only. No Docker socket is required — the collector reads log files
						off the host filesystem directly.
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
						up from the host log file and ships it with <InlineCode>service.name</InlineCode> set to the
						container's ID.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<SendLogsStep number={5} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Open Search and query for <InlineCode>hello from logwiz</InlineCode>. The record
						typically arrives within ~5 seconds (the batch interval). For apps that set
						<InlineCode>service.name</InlineCode> themselves via the OTel SDK, you'll see the SDK-provided
						name; for bare containers (like the smoke test above), you'll see the container ID.
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
