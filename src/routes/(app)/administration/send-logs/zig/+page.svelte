<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Zig" docHref="https://docs.logwiz.io/send-logs/languages/zig">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Add the OpenTelemetry SDK</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Fetch the SDK into your project's <InlineCode>build.zig.zon</InlineCode>, then wire it
						into <InlineCode>build.zig</InlineCode>.
					</p>
				</div>
				<Callout variant="warning">
					This SDK is in alpha (v0.1.1) and has not been battle-tested in production. Expect
					breaking changes between releases.
				</Callout>
				<p class="text-sm text-base-content/70">
					Requires Zig ≥ 0.15.2. Run this in your project root:
				</p>
				<CodeBlock {...data.snippets.fetch} copyTitle="Copy fetch command" />
				<p class="text-sm text-base-content/70">
					Then add these lines to <InlineCode>build.zig</InlineCode> after your
					<InlineCode>exe</InlineCode> declaration:
				</p>
				<CodeBlock {...data.snippets.build} copyTitle="Copy build.zig snippet" />
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The SDK reads these automatically at startup — no code changes needed per service.
					</p>
				</div>
				<CodeBlock {...data.snippets.envVars} copyTitle="Copy environment variables" />
				<Callout variant="warning">
					<p>
						The <InlineCode>%20</InlineCode> after <InlineCode>Bearer</InlineCode> is required — OTEL
						expects URL-encoded header values.
					</p>
				</Callout>
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Minimal working example</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this as <InlineCode>src/main.zig</InlineCode> and run
						<InlineCode>zig build run</InlineCode>. The bridge reads endpoint and auth from the
						environment variables above.
					</p>
				</div>
				<CodeBlock {...data.snippets.example} copyTitle="Copy example" />
			</SendLogsStep>

			<VerifySearchStep number={4}>
				Run your program, then open Search and filter on <InlineCode>service_name</InlineCode>
				to see your log arrive (typically within 2 seconds).
			</VerifySearchStep>
		</ol>
	{/if}
</SendLogsSourceShell>
