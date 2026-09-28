<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { issuesToFieldErrors, toFormErrors } from '$lib/api/errors';
	import { createSource } from '$lib/api/indexes';
	import { createSourceSchema } from 'api/schemas';
	import type { IndexDetail } from 'api/types';
	import SourceFields from './SourceFields.svelte';
	import { emptySourceForm, formToCreateInput, parseClientParams } from './source-form';

	let { detail }: { detail: IndexDetail } = $props();

	let form = $state(emptySourceForm());
	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let alertEl = $state<HTMLElement>();

	// the submit button sits below the alert on long forms, so bring the alert into view
	async function showFormError(message: string) {
		formError = message;
		await tick();
		alertEl?.scrollIntoView({ block: 'nearest' });
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};
		formError = null;

		if (form.sourceType === 'kafka') {
			const clientParams = parseClientParams(form.clientParamsJson);
			if (clientParams.error) {
				fieldErrors = { clientParams: clientParams.error };
				return;
			}
		}

		const parsed = v.safeParse(createSourceSchema, formToCreateInput(form));
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			await showFormError('Please fix the highlighted fields.');
			return;
		}

		submitting = true;
		try {
			await createSource(detail.indexId, parsed.output);
			toast.success('Source created');
			await invalidate(DEP.index(detail.indexId));
			await goto(`/settings/indexes/${encodeURIComponent(detail.indexId)}?tab=sources`);
		} catch (err) {
			const formErrors = toFormErrors(err, 'Failed to create source');
			fieldErrors = formErrors.fieldErrors;
			await showFormError(formErrors.message);
		} finally {
			submitting = false;
		}
	}
</script>

<form
	{onsubmit}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	{#if formError}
		<div bind:this={alertEl} role="alert" class="alert alert-error mx-4 mt-4 text-sm">
			{formError}
		</div>
	{/if}

	<SourceFields bind:form {fieldErrors} mode="create" />

	<div class="flex justify-end gap-2 px-4 py-3">
		<a
			href={`/settings/indexes/${encodeURIComponent(detail.indexId)}?tab=sources`}
			class="btn btn-ghost btn-sm"
		>
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
