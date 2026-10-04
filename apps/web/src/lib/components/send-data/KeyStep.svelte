<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { getApiKey, type ApiKeyView } from '#lib/api/api-keys.js';
	import { DEP } from '#lib/api/deps.js';
	import CreateApiKeyModal from '#lib/components/settings/api-keys/CreateApiKeyModal.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '#lib/components/send-data/constants.js';
	import type { Signal } from '#lib/components/send-data/types.js';
	import type { IndexSummary } from 'api/types';

	let {
		signal,
		apiKeys,
		indexes,
		traceIndexId,
		selectedIndexId,
		selectedApiKeyId = $bindable<number | null>(null),
		realApiKeyValue = $bindable<string | null>(null)
	}: {
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
	let loadFailed = $state(false);

	// Loads the plaintext value whenever a key is selected without one: the parent's preselection on
	// mount, or a pick from the select. A newly created key arrives with its value and skips the fetch.
	// Any change of key or value reruns this, which cancels a stale fetch.
	$effect(() => {
		const id = selectedApiKeyId;
		if (id == null || realApiKeyValue != null) return;

		let cancelled = false;
		(async () => {
			try {
				const { token } = await getApiKey(id);
				if (!cancelled) realApiKeyValue = token;
			} catch {
				// Shown inline instead of a toast; the snippets keep the placeholder meanwhile.
				if (!cancelled) loadFailed = true;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function pick(id: number | null) {
		selectedApiKeyId = id;
		realApiKeyValue = null;
		loadFailed = false;
	}
</script>

{#if apiKeys.length === 0}
	<p class="text-muted">
		Until you do, the snippets show
		<code class="bg-base-200 rounded px-1 text-xs">&lt;your-ingest-key&gt;</code>.
	</p>
	<div>
		<button type="button" class="btn btn-primary btn-sm" onclick={() => (createOpen = true)}>
			<Plus class="size-3.5" aria-hidden="true" />
			Create ingest key
		</button>
	</div>
{:else}
	{#if loadFailed}
		<p class="text-error">Couldn't load this key. Reload the page to try again.</p>
	{:else}
		<p class="text-muted">The snippets below use it.</p>
	{/if}
	<div class="flex flex-wrap items-center gap-2">
		<select
			class="select select-sm w-72"
			aria-label="Ingest key"
			bind:value={() => selectedApiKeyId, pick}
		>
			{#each apiKeys as apiKey (apiKey.id)}
				<option value={apiKey.id}>{apiKey.name} — {apiKey.indexId}</option>
			{/each}
		</select>
		<button type="button" class="btn btn-ghost btn-sm" onclick={() => (createOpen = true)}>
			<Plus class="size-3.5" aria-hidden="true" />
			New key
		</button>
	</div>
	{#if signal === 'traces'}
		{#if traceIndexId}
			<p class="text-muted text-xs">
				Spans always go to <span class="text-base-content font-mono">{traceIndexId}</span>
			</p>
		{:else}
			<p class="text-warning-ink text-xs">
				Quickwit has no span store, so spans you send have nowhere to land.
			</p>
		{/if}
	{:else}
		<p class="text-muted text-xs">
			Logs go to <span class="text-base-content font-mono">{selectedIndexId}</span>.
		</p>
	{/if}
{/if}

<CreateApiKeyModal
	bind:open={createOpen}
	{indexes}
	defaultIndexId={DEFAULT_OTEL_LOGS_INDEX_ID}
	{traceIndexId}
	invalidateKey={DEP.sendTelemetryApiKeys}
	revealOnCreate={false}
	onCreated={(summary, secret) => {
		selectedApiKeyId = summary.id;
		realApiKeyValue = secret;
		loadFailed = false;
	}}
/>
