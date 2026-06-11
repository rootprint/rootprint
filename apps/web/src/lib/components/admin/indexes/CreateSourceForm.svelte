<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { createSource } from '$lib/api/indexes';
	import { createSourceSchema } from 'api/schemas';
	import type { IndexDetail } from 'api/types';
	import SourceFields from './SourceFields.svelte';
	import { emptySourceForm, formToCreateInput } from './source-form';

	let { detail }: { detail: IndexDetail } = $props();

	let form = $state(emptySourceForm());
	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};

		const parsed = v.safeParse(createSourceSchema, formToCreateInput(form));
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			await createSource(detail.indexId, parsed.output);
			toast.success('Source created');
			await invalidate(DEP.index(detail.indexId));
			await goto(`/settings/indexes/${detail.indexId}?tab=sources`);
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				toast.error(err.message);
			} else {
				toast.error(err instanceof Error ? err.message : 'Failed to create source');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<form
	{onsubmit}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	<SourceFields bind:form {fieldErrors} mode="create" />

	<div class="flex justify-end gap-2 px-4 py-3">
		<a href={`/settings/indexes/${detail.indexId}?tab=sources`} class="btn btn-ghost btn-sm">
			Cancel
		</a>
		<button type="submit" class="btn btn-primary btn-sm" disabled={submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
				Creating…
			{:else}
				Create source
			{/if}
		</button>
	</div>
</form>
