<script lang="ts">
	import { Search } from 'lucide-svelte';

	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Vector" docHref="https://docs.logwiz.io/send-logs/log-agents/vector">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install Vector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Install the Vector package for your platform from the official installation page —
						the per-distro instructions are maintained upstream.
					</p>
				</div>
				<div>
					<a
						href="https://vector.dev/docs/setup/installation/"
						target="_blank"
						rel="noreferrer"
						class="btn gap-2 btn-sm btn-primary"
					>
						Open Vector installation
					</a>
				</div>
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Write the Vector config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this at <InlineCode>/etc/vector/vector.yaml</InlineCode>. The endpoint and token
						are prefilled. Replace
						<InlineCode>/var/log/myapp/*.log</InlineCode> with the glob that matches your application's
						log files, and <InlineCode>myapp</InlineCode> with your service name.
					</p>
				</div>
				<CodeBlock {...data.snippets.vectorConfig} copyTitle="Copy vector.yaml" />
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Restart Vector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The status output should show <InlineCode>active (running)</InlineCode> with no config-parse
						or sink-startup errors in the recent log lines.
					</p>
				</div>
				<CodeBlock {...data.snippets.restart} copyTitle="Copy restart command" />
			</SendLogsStep>

			<SendLogsStep number={4}>
				<div>
					<h3 class="font-semibold">Send a test log line</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Create the application log directory if it doesn't exist yet and append a single line.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<SendLogsStep number={5} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Search for <InlineCode>hello from vector</InlineCode>. Records typically appear within
						5–10 seconds — the OTLP path commits on Quickwit's normal cadence, there is no
						<InlineCode>commit=wait_for</InlineCode> knob.
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
