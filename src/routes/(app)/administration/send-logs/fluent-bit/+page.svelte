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

<SendLogsSourceShell title="Fluent Bit">
	<Callout variant="warning">
		<p>
			Linux-only. The <InlineCode>tail</InlineCode> input paths,
			<InlineCode>systemctl</InlineCode> invocations, and package-manager install commands below assume
			a Debian/RHEL-family host. Fluent Bit's
			<InlineCode>opentelemetry</InlineCode> output reaches OTLP/HTTP parity in 2.x and later — pin
			to a recent Fluent Bit release if you can.
		</p>
	</Callout>

	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install Fluent Bit</h3>
					<p class="mt-1 text-sm text-base-content/60">On Debian and Ubuntu:</p>
				</div>
				<CodeBlock {...data.snippets.apt} copyTitle="Copy apt install" />
				<p class="text-sm text-base-content/60">On RHEL, Rocky, AlmaLinux, and Fedora:</p>
				<CodeBlock {...data.snippets.dnf} copyTitle="Copy dnf install" />
				<p class="text-sm text-base-content/60">
					For other Linux distributions, see <a
						href="https://docs.fluentbit.io/manual/installation/getting-started-with-fluent-bit"
						target="_blank"
						rel="noreferrer"
						class="link link-hover">Fluent Bit's installation docs</a
					>.
				</p>
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Write the Fluent Bit config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this at <InlineCode>/etc/fluent-bit/fluent-bit.conf</InlineCode>. The endpoint and
						token are prefilled. Replace
						<InlineCode>/var/log/myapp/*.log</InlineCode> with the glob that matches your
						application's log files, and <InlineCode>myapp.*</InlineCode> with a tag that identifies
						your service.
					</p>
				</div>
				<CodeBlock {...data.snippets.fluentBitConfig} copyTitle="Copy fluent-bit.conf" />
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Restart Fluent Bit</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The status output should show <InlineCode>active (running)</InlineCode> with no
						config-parse or output-startup errors in the recent log lines.
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
						Search for <InlineCode>hello from fluent-bit</InlineCode>. Records typically appear
						within 5–10 seconds — the OTLP path commits on Quickwit's normal cadence, there is no
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
