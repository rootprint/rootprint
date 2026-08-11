<script lang="ts">
	import { page } from '$app/state';
	import { ExternalLink } from 'lucide-svelte';
	import CreateApiKeyModal from '$lib/components/admin/api-keys/CreateApiKeyModal.svelte';
	import ApiKeyChip from './ApiKeyChip.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import { resolveBreadcrumbs } from '$lib/settings-nav';
	import { DEP } from '$lib/api/deps';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/send-telemetry/constants';
	import type { Integration, Signal } from '$lib/send-telemetry/types';
	import type { ApiKeyView } from '$lib/api/api-keys';
	import type { IndexSummary } from 'api/types';

	let {
		integration,
		signal,
		apiKeys,
		indexes,
		traceIndexId,
		selectedIndexId,
		selectedApiKeyId = $bindable<number | null>(null),
		realApiKeyValue = $bindable<string | null>(null)
	}: {
		integration: Integration;
		signal: Signal;
		apiKeys: ApiKeyView[];
		indexes: IndexSummary[];
		/** Null when the span store does not exist in Quickwit. */
		traceIndexId: string | null;
		selectedIndexId: string;
		selectedApiKeyId?: number | null;
		realApiKeyValue?: string | null;
	} = $props();

	let createOpen = $state(false);

	const segments = $derived([
		...resolveBreadcrumbs(page.route.id, page.params).slice(0, -1),
		{ label: integration.label }
	]);

	function handleCreated(summary: ApiKeyView, secret: string) {
		selectedApiKeyId = summary.id;
		realApiKeyValue = secret;
		createOpen = false;
	}
</script>

<header class="flex flex-col gap-4">
	<Breadcrumb {segments} />
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-h1">{integration.label}</h1>
		<a
			href={integration.docs}
			target="_blank"
			rel="noreferrer"
			class="link link-hover text-base-content/60 hover:text-base-content flex items-center gap-1.5 text-xs"
		>
			Documentation
			<ExternalLink class="h-3 w-3" />
		</a>
	</div>
	{#if signal === 'traces'}
		{#if traceIndexId}
			<p class="text-base-content/60 text-xs">
				Spans go to <span class="text-base-content font-mono">{traceIndexId}</span> — the span store,
				not the key’s index.
			</p>
		{:else}
			<p class="text-warning text-xs">
				No span store exists in Quickwit yet, so spans sent with this key have nowhere to land.
			</p>
		{/if}
	{:else}
		<p class="text-base-content/60 text-xs">
			Sending to <span class="text-base-content">{selectedIndexId}</span>
		</p>
	{/if}
	<ApiKeyChip
		{apiKeys}
		bind:selectedApiKeyId
		bind:realApiKeyValue
		onCreateRequested={() => (createOpen = true)}
	/>
</header>

<CreateApiKeyModal
	bind:open={createOpen}
	{indexes}
	defaultIndexId={DEFAULT_OTEL_LOGS_INDEX_ID}
	{traceIndexId}
	invalidateKey={DEP.sendTelemetryApiKeys}
	onCreated={handleCreated}
/>
