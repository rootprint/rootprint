<script lang="ts">
	import CreateTokenModal from '$lib/components/admin/CreateTokenModal.svelte';
	import TokenChip from './TokenChip.svelte';
	import { SEND_LOGS_TOKENS_INVALIDATE_KEY } from '$lib/send-logs/constants';
	import type { Integration } from '$lib/send-logs/types';
	import type { IngestTokenView } from '$lib/types';

	let {
		integration,
		indexId,
		tokens,
		selectedTokenId = $bindable<number | null>(null),
		realTokenValue = $bindable<string | null>(null)
	}: {
		integration: Integration;
		indexId: string;
		tokens: IngestTokenView[];
		selectedTokenId?: number | null;
		realTokenValue?: string | null;
	} = $props();

	let createOpen = $state(false);

	function handleCreated(summary: IngestTokenView, token: string) {
		selectedTokenId = summary.id;
		realTokenValue = token;
		createOpen = false;
	}
</script>

<header class="flex flex-col gap-4">
	<p class="eyebrow">Administration / Send logs / {integration.label}</p>
	<h1 class="text-h1">{integration.label}</h1>
	<p class="text-base-content/60 font-mono text-xs">
		Sending to <span class="text-base-content">{indexId}</span>
	</p>
	<TokenChip
		{tokens}
		bind:selectedTokenId
		bind:realTokenValue
		onCreateRequested={() => (createOpen = true)}
	/>
</header>

<CreateTokenModal
	bind:open={createOpen}
	indexIds={[indexId]}
	invalidateKey={SEND_LOGS_TOKENS_INVALIDATE_KEY}
	onCreated={handleCreated}
/>
