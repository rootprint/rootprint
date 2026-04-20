<script lang="ts">
	import { Search } from 'lucide-svelte';

	import { page } from '$app/state';
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';
	import type { DotnetLogFlavor } from '$lib/types';

	const TABS: { id: DotnetLogFlavor; label: string }[] = [
		{ id: 'auto', label: 'Auto-instrumentation' },
		{ id: 'sdk', label: 'SDK' }
	];

	let { data } = $props();

	const flavor = $derived.by<DotnetLogFlavor>(() => {
		const raw = page.url.searchParams.get('flavor');
		return TABS.some((t) => t.id === raw) ? (raw as DotnetLogFlavor) : 'auto';
	});

	const activeFlavor = $derived(data.flavors?.[flavor]);
</script>

<SendLogsSourceShell title=".NET">
	{#if !data.token || !data.flavors || !activeFlavor}
		<SendLogsTokenCallout />
	{:else}
		<div
			role="tablist"
			aria-label="Integration"
			class="flex items-center gap-1 border-b border-base-300"
		>
			{#each TABS as tab (tab.id)}
				{@const isActive = tab.id === flavor}
				<a
					href="?flavor={tab.id}"
					role="tab"
					aria-current={isActive ? 'page' : undefined}
					aria-selected={isActive}
					class={[
						'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
						isActive
							? 'border-base-content font-medium text-base-content'
							: 'border-transparent text-base-content/60 hover:text-base-content'
					]}
				>
					{tab.label}
				</a>
			{/each}
		</div>

		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">
						{flavor === 'auto' ? 'Install the auto-instrumentation bundle' : 'Add the SDK packages'}
					</h3>
					<p class="mt-1 text-sm text-base-content/60">
						{flavor === 'auto'
							? 'The installer drops the profiler + instrumentation assemblies under ~/.otel-dotnet-auto.'
							: 'Two NuGet packages: the OTel hosting extension and the OTLP exporter.'}
					</p>
				</div>
				<CodeBlock {...activeFlavor.install} copyTitle="Copy install command" />
				{#if flavor === 'auto'}
					<Callout variant="info">
						<p>
							.NET 6+ supported. The Linux/macOS script is shown; the PowerShell equivalent is in
							comments.
						</p>
					</Callout>
				{:else}
					<Callout variant="info">
						<p>.NET 6+ recommended. Works with ASP.NET Core and generic hosts.</p>
					</Callout>
				{/if}
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						{flavor === 'auto'
							? 'These activate the CLR profiler and point the auto-instrumentation at Logwiz.'
							: 'The OTLP exporter reads these automatically.'}
					</p>
				</div>
				<CodeBlock {...activeFlavor.envVars} copyTitle="Copy environment variables" />
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
						{flavor === 'auto'
							? 'A plain ILogger call — the auto-instrumentation captures and forwards it.'
							: 'Register OTel on the host logger, then log normally.'}
					</p>
				</div>
				<CodeBlock {...activeFlavor.example} copyTitle="Copy example" />
			</SendLogsStep>

			<SendLogsStep number={4} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Run your program, then open Search and filter on <InlineCode>service_name</InlineCode> to
						see your log arrive (typically within 2 seconds).
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
