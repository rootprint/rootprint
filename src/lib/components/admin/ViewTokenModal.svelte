<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { getIngestToken } from '$lib/api/ingest-tokens.remote';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import type { IngestTokenSummary } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		token
	}: {
		open: boolean;
		token: IngestTokenSummary | null;
	} = $props();

	let loading = $state(false);
	let tokenValue = $state('');

	$effect(() => {
		if (!open || !token) {
			return;
		}
		void fetchToken(token.id);
	});

	async function fetchToken(tokenId: number) {
		loading = true;
		tokenValue = '';
		try {
			const result = await getIngestToken({ tokenId });
			tokenValue = result.token;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to load ingest token'));
			open = false;
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		tokenValue = '';
		loading = false;
	}

	function handleDone() {
		open = false;
	}
</script>

<Modal bind:open title="Ingest token: {token?.name ?? ''}" onclose={handleClose}>
	<div class="mt-4 flex flex-col gap-3">
		{#if loading}
			<div class="flex items-center gap-2 py-4 text-sm text-base-content/70">
				<span class="loading loading-sm loading-spinner"></span>
				Loading token…
			</div>
		{:else if tokenValue}
			<div class="flex gap-2">
				<input
					type="text"
					class="input-bordered input input-sm flex-1 font-mono text-xs"
					readonly
					value={tokenValue}
				/>
				<CopyButton text={tokenValue} class="btn btn-sm btn-neutral">
					{#snippet children({ copied })}
						{copied ? 'Copied!' : 'Copy'}
					{/snippet}
				</CopyButton>
			</div>
		{/if}
		<div class="modal-action">
			<button type="button" class="btn btn-primary" onclick={handleDone}>Close</button>
		</div>
	</div>
</Modal>
