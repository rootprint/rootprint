<script lang="ts">
	import * as v from 'valibot';
	import { invalidate } from '$app/navigation';
	import { client } from '$lib/api/client';
	import { toFieldErrors } from '$lib/api/errors';
	import Modal from '$lib/components/ui/Modal.svelte';
	import TokenSecretReveal from './TokenSecretReveal.svelte';
	import { createIngestTokenSchema, type CreateIngestTokenInput } from 'api/schemas';
	import type { ApiErrorBody } from 'api/types';
	import type { IngestTokenView } from '$lib/types';

	let {
		open = $bindable(false),
		indexIds,
		invalidateKey = 'app:tokens',
		onCreated
	}: {
		open?: boolean;
		indexIds: string[];
		invalidateKey?: string;
		onCreated?: (summary: IngestTokenView, token: string) => void;
	} = $props();

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let indexId = $state('');
	let busy = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let revealedToken = $state('');

	function reset() {
		phase = 'form';
		name = '';
		indexId = indexIds.length === 1 ? indexIds[0] : '';
		busy = false;
		formError = null;
		fieldErrors = {};
		revealedToken = '';
	}

	$effect(() => {
		if (open) reset();
	});

	function handleClose() {
		reset();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createIngestTokenSchema, { name, indexId });
		if (!parsed.success) {
			for (const issue of parsed.issues) {
				const key = issue.path?.[0]?.key as string | undefined;
				if (key) fieldErrors[key] = issue.message;
			}
			return;
		}
		const input: CreateIngestTokenInput = parsed.output;

		busy = true;
		const res = await client.api['ingest-tokens'].$post({ json: input });
		if (!res.ok) {
			const body = (await res.json()) as ApiErrorBody;
			formError = body.error.message;
			fieldErrors = toFieldErrors(body);
			busy = false;
			return;
		}
		const result = await res.json();
		revealedToken = result.token;
		phase = 'reveal';
		busy = false;
		await invalidate(invalidateKey);
		onCreated?.(result.summary, result.token);
	}
</script>

<Modal bind:open title="Create ingest token" onclose={handleClose}>
	{#if phase === 'form'}
		<form class="flex flex-col gap-4" onsubmit={submit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}

			<label class="input w-full" class:input-error={fieldErrors.name}>
				<span class="label">Token name</span>
				<input bind:value={name} placeholder="production-shipper" autocomplete="off" required />
			</label>
			{#if fieldErrors.name}
				<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.name}</p>
			{/if}

			{#if indexIds.length > 1}
				<label class="select w-full" class:select-error={fieldErrors.indexId}>
					<span class="label">Index</span>
					<select bind:value={indexId} required>
						<option value="" disabled>Select an index…</option>
						{#each indexIds as id (id)}
							<option value={id}>{id}</option>
						{/each}
					</select>
				</label>
				{#if fieldErrors.indexId}
					<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.indexId}</p>
				{/if}
			{/if}

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					disabled={busy}
					onclick={() => (open = false)}
				>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={busy}>
					{busy ? 'Creating…' : 'Create token'}
				</button>
			</div>
		</form>
	{:else}
		<TokenSecretReveal value={revealedToken} />
		<div class="modal-action">
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		</div>
	{/if}
</Modal>
