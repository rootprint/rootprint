<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Caddy" docHref="https://docs.logwiz.io/send-logs/web-servers/caddy">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Enable Caddy file logging</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Stock Caddy installs log to <InlineCode>journald</InlineCode>. Add the following to
						<InlineCode>/etc/caddy/Caddyfile</InlineCode> so Caddy writes JSON to file instead. The
						<InlineCode>log</InlineCode> block has to be added to every site whose access log you want
						shipped — leave the default JSON encoder in place.
					</p>
				</div>
				<CodeBlock {...data.snippets.caddyfile} copyTitle="Copy Caddyfile snippet" />
				<CodeBlock {...data.snippets.reloadCaddy} copyTitle="Copy reload command" />
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Install Vector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Install the Vector package for your platform from the official installation page — the
						per-distro instructions are maintained upstream.
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

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Write the Vector config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this at <InlineCode>/etc/vector/vector.yaml</InlineCode>. The endpoint and token
						are prefilled.
					</p>
				</div>
				<CodeBlock {...data.snippets.vectorConfig} copyTitle="Copy vector.yaml" />
			</SendLogsStep>

			<SendLogsStep number={4}>
				<div>
					<h3 class="font-semibold">Grant Vector read access to /var/log/caddy</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The default Caddy package creates <InlineCode>/var/log/caddy/</InlineCode> owned by
						<InlineCode>caddy:caddy</InlineCode> with mode <InlineCode>750</InlineCode>, so add the
						<InlineCode>vector</InlineCode> user to the <InlineCode>caddy</InlineCode> group.
					</p>
				</div>
				<CodeBlock {...data.snippets.groupAdd} copyTitle="Copy group-add command" />
			</SendLogsStep>

			<SendLogsStep number={5}>
				<div>
					<h3 class="font-semibold">Restart Vector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The status output should show <InlineCode>active (running)</InlineCode> with no config-parse
						or sink-startup errors in the recent log lines.
					</p>
				</div>
				<CodeBlock {...data.snippets.restart} copyTitle="Copy restart command" />
			</SendLogsStep>

			<SendLogsStep number={6}>
				<div>
					<h3 class="font-semibold">Send a test request</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Hit any site Caddy is serving so it writes a fresh access-log line. Replace
						<InlineCode>http://localhost/</InlineCode> with whichever site URL you configured the
						<InlineCode>log</InlineCode> block on.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<VerifySearchStep number={7}>
				Search for <InlineCode>service.name:caddy</InlineCode>. Records typically appear within 5–10
				seconds — the OTLP path commits on Quickwit's normal cadence, there is no
				<InlineCode>commit=wait_for</InlineCode> knob.
			</VerifySearchStep>
		</ol>
	{/if}
</SendLogsSourceShell>
