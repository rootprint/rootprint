<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';

	let { data } = $props();
</script>

<SendLogsSourceShell
	title="Fluent Bit"
	docHref="https://docs.logwiz.io/send-logs/log-agents/fluent-bit"
>
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install Fluent Bit</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Install the Fluent Bit package for your platform from the official downloads page — the
						per-distro instructions are maintained upstream.
					</p>
				</div>
				<div>
					<a
						href="https://docs.fluentbit.io/manual/installation/downloads"
						target="_blank"
						rel="noreferrer"
						class="btn gap-2 btn-sm btn-primary"
					>
						Open Fluent Bit downloads
					</a>
				</div>
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Write the Fluent Bit config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this at <InlineCode>/etc/fluent-bit/fluent-bit.conf</InlineCode>. The endpoint and
						token are prefilled. Replace
						<InlineCode>/var/log/myapp/*.log</InlineCode> with the glob that matches your application's
						log files, and <InlineCode>myapp.*</InlineCode> with a tag that identifies your service.
					</p>
				</div>
				<CodeBlock {...data.snippets.fluentBitConfig} copyTitle="Copy fluent-bit.conf" />
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Restart Fluent Bit</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The status output should show <InlineCode>active (running)</InlineCode> with no config-parse
						or output-startup errors in the recent log lines.
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

			<VerifySearchStep number={5}>
				Search for <InlineCode>hello from fluent-bit</InlineCode>. Records typically appear within
				5–10 seconds — the OTLP path commits on Quickwit's normal cadence, there is no
				<InlineCode>commit=wait_for</InlineCode> knob.
			</VerifySearchStep>
		</ol>
	{/if}
</SendLogsSourceShell>
