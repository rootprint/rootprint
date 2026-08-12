<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { issuesToFieldErrors, toFormErrors } from '$lib/api/errors';
	import { saveIndexConfig } from '$lib/api/indexes';
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import { saveIndexConfigSchema, type SaveIndexConfigInput } from 'api/schemas';
	import type { IndexDetail } from 'api/types';

	let { detail }: { detail: IndexDetail } = $props();

	const initial = detail;
	let displayName = $state(initial.displayName ?? '');
	const isTraceIndex = initial.isTraceIndex;
	let levelField = $state(initial.levelField);
	let messageField = $state(initial.messageField);
	let tracebackField = $state(initial.tracebackField ?? '');
	let contextFieldTags = $state<string[]>([...(initial.contextFields ?? [])]);
	let traceIdField = $state(initial.traceIdField);

	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};

		const payload: SaveIndexConfigInput = {
			displayName: displayName.trim() === '' ? null : displayName.trim(),
			levelField: levelField.trim(),
			messageField: messageField.trim(),
			tracebackField: tracebackField.trim() === '' ? null : tracebackField.trim(),
			contextFields: contextFieldTags.length === 0 ? null : [...contextFieldTags],
			traceIdField: traceIdField.trim()
		};

		const parsed = v.safeParse(saveIndexConfigSchema, payload);
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			toast.error('Please fix the highlighted fields.');
			return;
		}

		submitting = true;
		try {
			await saveIndexConfig(detail.indexId, parsed.output);
			toast.success('Index configuration saved');
			await invalidate(DEP.index(detail.indexId));
		} catch (err) {
			const formErrors = toFormErrors(err, 'Failed to save config');
			fieldErrors = formErrors.fieldErrors;
			toast.error(formErrors.message);
		} finally {
			submitting = false;
		}
	}
</script>

<form
	{onsubmit}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	<SettingsRow
		id="cfg-display-name"
		label="Display name"
		hint="Friendly name shown to users in search."
		error={fieldErrors.displayName}
	>
		{#snippet children({ id, invalid, describedBy })}
			<input
				{id}
				type="text"
				bind:value={displayName}
				class="input input-sm w-full"
				class:input-error={invalid}
				placeholder="e.g. Production Traces"
				autocomplete="off"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
		{/snippet}
	</SettingsRow>

	{#if !isTraceIndex}
		<SettingsRow
			id="cfg-level-field"
			label="Level field"
			hint="Field that carries the log severity."
			error={fieldErrors.levelField}
		>
			{#snippet children({ id, invalid, describedBy })}
				<input
					{id}
					type="text"
					bind:value={levelField}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="level"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="cfg-message-field"
			label="Message field"
			hint="The primary human-readable message per row."
			error={fieldErrors.messageField}
		>
			{#snippet children({ id, invalid, describedBy })}
				<input
					{id}
					type="text"
					bind:value={messageField}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="message"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="cfg-traceback-field"
			label="Traceback field"
			hint="Dot-notation path to stacktrace data. Optional."
			error={fieldErrors.tracebackField}
		>
			{#snippet children({ id, invalid, describedBy })}
				<input
					{id}
					type="text"
					bind:value={tracebackField}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="e.g. message.traceback"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			id="cfg-trace-id-field"
			label="Trace ID field"
			hint="Log field carrying the W3C trace id, used to link a log line to its trace. Supports dot-notation."
			error={fieldErrors.traceIdField}
		>
			{#snippet children({ id, invalid, describedBy })}
				<input
					{id}
					type="text"
					bind:value={traceIdField}
					class="input input-sm w-full"
					class:input-error={invalid}
					placeholder="trace_id"
					autocomplete="off"
					aria-invalid={invalid ? 'true' : undefined}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</SettingsRow>

		<SettingsRow
			plain
			label="Context fields"
			hint="Fields used for log context search. Leave empty to use all fields. Supports dot-notation."
			error={fieldErrors.contextFields}
		>
			{#snippet children({ invalid })}
				<TagInput
					bind:tags={contextFieldTags}
					placeholderEmpty="service.name  (press Enter to add)"
					addLabel="Add context field"
					error={invalid}
				/>
			{/snippet}
		</SettingsRow>
	{/if}

	<div class="flex justify-end px-4 py-3">
		<button type="submit" class="btn btn-primary btn-sm" disabled={submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
				Saving…
			{:else}
				Save
			{/if}
		</button>
	</div>
</form>
