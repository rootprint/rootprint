<script lang="ts">
	import { Plus, X, ChevronDown } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { getApiKey, type ApiKeyView } from '$lib/api/api-keys';

	let {
		apiKeys,
		selectedApiKeyId = $bindable<number | null>(null),
		realApiKeyValue = $bindable<string | null>(null),
		onCreateRequested
	}: {
		apiKeys: ApiKeyView[];
		selectedApiKeyId?: number | null;
		realApiKeyValue?: string | null;
		onCreateRequested: () => void;
	} = $props();

	const selectedApiKey = $derived(
		selectedApiKeyId != null ? (apiKeys.find((k) => k.id === selectedApiKeyId) ?? null) : null
	);

	let dropdownOpen = $state(false);

	// Fetch the plaintext key value whenever a key is selected without one.
	// Covers both initial preselection (set by the parent on mount) and manual
	// selection via `selectApiKey` below.
	$effect(() => {
		const id = selectedApiKeyId;
		if (id == null) return;
		if (realApiKeyValue != null) return;

		let cancelled = false;
		(async () => {
			try {
				const { token: secret } = await getApiKey(id);
				if (cancelled || selectedApiKeyId !== id) return;
				realApiKeyValue = secret;
			} catch (e) {
				if (cancelled || selectedApiKeyId !== id) return;
				toast.error(e instanceof Error ? e.message : 'Failed to load API key');
				if (selectedApiKeyId === id) selectedApiKeyId = null;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function selectApiKey(apiKey: ApiKeyView) {
		dropdownOpen = false;
		selectedApiKeyId = apiKey.id;
		realApiKeyValue = null;
	}

	function clear() {
		selectedApiKeyId = null;
		realApiKeyValue = null;
	}

	function handleCreate() {
		dropdownOpen = false;
		onCreateRequested();
	}
</script>

<div class="dropdown" class:dropdown-open={dropdownOpen}>
	<div class="border-line rounded-box bg-base-100 flex items-center gap-3 border px-3 py-2">
		<span class="text-base-content/60 text-xs tracking-wider uppercase">API key</span>

		{#if selectedApiKey}
			<button
				type="button"
				class="hover:bg-base-200/60 flex items-center gap-2 rounded px-2 py-1 text-sm"
				onclick={() => (dropdownOpen = !dropdownOpen)}
			>
				<span>{selectedApiKey.name}</span>
				<span class="text-base-content/50 text-xs">·</span>
				<span class="text-base-content/60 font-mono text-xs">{selectedApiKey.indexId}</span>
				<span class="text-base-content/50 text-xs">·</span>
				<span class="text-base-content/60 font-mono text-xs">{selectedApiKey.tokenPrefix}…</span>
				<ChevronDown size={14} class="opacity-60" />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs ml-auto"
				aria-label="Clear API key selection"
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
				Select an API key
			</button>
		{/if}
	</div>

	{#if dropdownOpen}
		<ul class="dropdown-content menu border-line rounded-box bg-base-100 z-10 mt-2 w-72 border p-2">
			{#each apiKeys as apiKey (apiKey.id)}
				<li>
					<button
						type="button"
						class="flex flex-col items-start"
						onclick={() => selectApiKey(apiKey)}
					>
						<span class="text-sm">{apiKey.name}</span>
						<span class="text-base-content/60 font-mono text-xs">
							{apiKey.indexId} · {apiKey.tokenPrefix}…
						</span>
					</button>
				</li>
			{:else}
				<li class="text-base-content/60 px-2 py-2 text-sm">No API keys yet.</li>
			{/each}
			<li class="border-line mt-1 border-t pt-1">
				<button type="button" class="text-primary gap-2" onclick={handleCreate}>
					<Plus size={14} />
					Create a new API key
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
