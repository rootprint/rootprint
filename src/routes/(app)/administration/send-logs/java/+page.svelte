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
	import type { JavaLogFlavor } from '$lib/types';

	const TABS: { id: JavaLogFlavor; label: string }[] = [
		{ id: 'agent', label: 'Java agent' },
		{ id: 'sdk', label: 'SDK' }
	];

	let { data } = $props();

	const flavor = $derived.by<JavaLogFlavor>(() => {
		const raw = page.url.searchParams.get('flavor');
		return TABS.some((t) => t.id === raw) ? (raw as JavaLogFlavor) : 'agent';
	});

	const activeFlavor = $derived(data.flavors?.[flavor]);
</script>

<SendLogsSourceShell title="Java">
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
						{flavor === 'agent' ? 'Download the Java agent' : 'Add the SDK dependencies'}
					</h3>
					<p class="mt-1 text-sm text-base-content/60">
						{flavor === 'agent'
							? 'The agent auto-instruments your app and bridges Logback, Log4j2, and JUL — no code changes required.'
							: 'Gradle Kotlin DSL shown. For Maven, add the same three artifacts under <dependencies>.'}
					</p>
				</div>
				<CodeBlock {...activeFlavor.install} copyTitle="Copy install command" />
				{#if flavor === 'agent'}
					<Callout variant="info">
						<p>Java 8+ supported. Auto-bridges Logback, Log4j2, and JUL.</p>
					</Callout>
				{:else}
					<Callout variant="info">
						<p>
							Java 17+ recommended. The logs API is stable in
							<InlineCode>opentelemetry-api</InlineCode> since 1.27.
						</p>
					</Callout>
				{/if}
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						{flavor === 'agent'
							? 'The agent reads these automatically. JAVA_TOOL_OPTIONS attaches the agent to any JVM.'
							: 'The SDK reads these automatically — set them once in your deployment environment.'}
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
						{flavor === 'agent'
							? 'A plain SLF4J logger — the agent handles everything else.'
							: 'Build a LoggerProvider, wire the OTLP exporter, emit one record.'}
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
