<script lang="ts">
	import { Info, TriangleAlert } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { updateSource } from '$lib/api/indexes';
	import { updateSourceSchema } from 'api/schemas';
	import type { SourceDetail } from 'api/types';
	import SourceFields from './SourceFields.svelte';
	import { formToUpdateInput, sourceDetailToForm, parseClientParams } from './source-form';

	let { indexId, source }: { indexId: string; source: SourceDetail } = $props();

	// Editable local copy seeded from the loaded source. The parent remounts this
	// component via {#key source.sourceId} when navigating between sources, so we
	// intentionally only seed from the initial prop value here.
	// svelte-ignore state_referenced_locally
	let form = $state(sourceDetailToForm(source));
	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};

		if (form.sourceType === 'kafka') {
			const clientParams = parseClientParams(form.clientParamsJson);
			if (clientParams.error) {
				fieldErrors = { clientParams: clientParams.error };
				return;
			}
		}

		const parsed = v.safeParse(updateSourceSchema, formToUpdateInput(form));
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			await updateSource(indexId, source.sourceId, parsed.output);
			toast.success('Source updated');
			await invalidate(DEP.index(indexId));
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				toast.error(err.message);
			} else {
				toast.error(err instanceof Error ? err.message : 'Failed to update source');
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
	{#if source.hasUnsupportedConfig}
		<div class="text-warning flex items-start gap-2 px-4 py-3 text-xs">
			<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
			<p>
				This source has connection settings Rootprint can't display (for example, multiple
				notifications). Saving here will replace them with the values shown below.
			</p>
		</div>
	{/if}
	<SourceFields bind:form {fieldErrors} mode="edit" />

	<div class="flex items-center justify-between gap-3 px-4 py-3">
		<p class="text-base-content/60 flex items-center gap-1.5 text-xs">
			<Info class="h-3.5 w-3.5 shrink-0" />
			Changing connection settings may reset this source's ingestion checkpoint.
		</p>
		<button type="submit" class="btn btn-primary btn-sm" disabled={submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
				Saving…
			{:else}
				Save changes
			{/if}
		</button>
	</div>
</form>
