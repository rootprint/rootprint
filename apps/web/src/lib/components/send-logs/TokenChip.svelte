<script lang="ts">
	import { Plus, X, ChevronDown } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { client } from '$lib/api/client';
	import type { ApiErrorBody } from 'api/types';
	import type { IngestTokenView } from '$lib/types';

	let {
		tokens,
		selectedTokenId = $bindable<number | null>(null),
		realTokenValue = $bindable<string | null>(null),
		onCreateRequested
	}: {
		tokens: IngestTokenView[];
		selectedTokenId?: number | null;
		realTokenValue?: string | null;
		onCreateRequested: () => void;
	} = $props();

	const selectedToken = $derived(
		selectedTokenId != null ? tokens.find((t) => t.id === selectedTokenId) ?? null : null
	);

	let dropdownOpen = $state(false);

	// Fetch the plaintext token value whenever a token is selected without one.
	// Covers both initial preselection (set by the parent on mount) and manual
	// selection via `selectToken` below.
	$effect(() => {
		const id = selectedTokenId;
		if (id == null) return;
		if (realTokenValue != null) return;

		let cancelled = false;
		(async () => {
			const res = await client.api['ingest-tokens'][':id'].$get({ param: { id: String(id) } });
			if (cancelled || selectedTokenId !== id) return;
			if (!res.ok) {
				const body = (await res.json()) as ApiErrorBody;
				toast.error(body.error.message);
				if (selectedTokenId === id) selectedTokenId = null;
				return;
			}
			const result = await res.json();
			if (cancelled || selectedTokenId !== id) return;
			realTokenValue = result.token;
		})();

		return () => {
			cancelled = true;
		};
	});

	function selectToken(token: IngestTokenView) {
		dropdownOpen = false;
		selectedTokenId = token.id;
		realTokenValue = null;
	}

	function clear() {
		selectedTokenId = null;
		realTokenValue = null;
	}

	function handleCreate() {
		dropdownOpen = false;
		onCreateRequested();
	}
</script>

<div class="dropdown" class:dropdown-open={dropdownOpen}>
	<div class="hairline rounded-box flex items-center gap-3 bg-base-100 px-3 py-2">
		<span class="text-base-content/60 font-mono text-xs uppercase tracking-wider">Token</span>

		{#if selectedToken}
			<button
				type="button"
				class="hover:bg-base-200/60 flex items-center gap-2 rounded px-2 py-1 text-sm"
				onclick={() => (dropdownOpen = !dropdownOpen)}
			>
				<span>{selectedToken.name}</span>
				<span class="text-base-content/50 font-mono text-xs">·</span>
				<span class="text-base-content/60 font-mono text-xs">{selectedToken.tokenPrefix}…</span>
				<ChevronDown size={14} class="opacity-60" />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs ml-auto"
				aria-label="Clear token selection"
				onclick={clear}
			>
				<X size={14} />
			</button>
		{:else}
			<button
				type="button"
				class="btn btn-ghost btn-sm gap-1"
				onclick={() => (dropdownOpen = !dropdownOpen)}
			>
				<Plus size={14} />
				Select a token
			</button>
		{/if}
	</div>

	{#if dropdownOpen}
		<ul class="dropdown-content menu hairline rounded-box bg-base-100 z-10 mt-2 w-72 p-2">
			{#each tokens as token (token.id)}
				<li>
					<button type="button" class="flex flex-col items-start" onclick={() => selectToken(token)}>
						<span class="text-sm">{token.name}</span>
						<span class="text-base-content/60 font-mono text-xs">{token.tokenPrefix}…</span>
					</button>
				</li>
			{:else}
				<li class="text-base-content/60 px-2 py-2 text-sm">No tokens yet.</li>
			{/each}
			<li class="border-base-content/10 mt-1 border-t pt-1">
				<button type="button" class="text-primary gap-2" onclick={handleCreate}>
					<Plus size={14} />
					Create a new token
				</button>
			</li>
		</ul>
	{/if}
</div>

<svelte:window
	onclick={(e) => {
		if (!dropdownOpen) return;
		const target = e.target as HTMLElement;
		if (!target.closest('.dropdown')) dropdownOpen = false;
	}}
/>
