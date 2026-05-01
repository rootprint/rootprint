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

<SendLogsSourceShell title="Nginx" docHref="https://docs.logwiz.io/send-logs/web-servers/nginx">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Confirm nginx is logging to file</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Stock nginx already writes <InlineCode>combined</InlineCode>-format access logs to
						<InlineCode>/var/log/nginx/access.log</InlineCode> and error logs to
						<InlineCode>/var/log/nginx/error.log</InlineCode> — this wizard targets those defaults,
						no <InlineCode>nginx.conf</InlineCode> changes required. If you have replaced the default
						<InlineCode>log_format</InlineCode>, see the docs for how to extend the parser.
					</p>
				</div>
			</SendLogsStep>

			<SendLogsStep number={2}>
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
					<h3 class="font-semibold">Grant Vector read access to /var/log/nginx</h3>
					<p class="mt-1 text-sm text-base-content/60">
						nginx's Debian/Ubuntu package owns <InlineCode>/var/log/nginx/</InlineCode> as
						<InlineCode>www-data:adm</InlineCode> with mode <InlineCode>640</InlineCode>, so add
						the <InlineCode>vector</InlineCode> user to the <InlineCode>adm</InlineCode> group.
					</p>
				</div>
				<CodeBlock {...data.snippets.groupAdd} copyTitle="Copy group-add command" />
			</SendLogsStep>

			<SendLogsStep number={5}>
				<div>
					<h3 class="font-semibold">Restart Vector</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The status output should show <InlineCode>active (running)</InlineCode> with no
						config-parse or sink-startup errors in the recent log lines.
					</p>
				</div>
				<CodeBlock {...data.snippets.restart} copyTitle="Copy restart command" />
			</SendLogsStep>

			<SendLogsStep number={6}>
				<div>
					<h3 class="font-semibold">Send a test request</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Hit any site nginx is serving so it writes a fresh access-log line. Replace
						<InlineCode>http://localhost/</InlineCode> with whichever site URL nginx is configured
						for.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<SendLogsStep number={7} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Search for <InlineCode>service.name:nginx</InlineCode>. Records typically appear within
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
