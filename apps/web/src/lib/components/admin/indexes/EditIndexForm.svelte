<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToPathErrors, toFieldErrors } from '$lib/api/errors';
	import { updateQuickwitConfig } from '$lib/api/indexes';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import {
		INDEX_MODES,
		updateQuickwitConfigSchema,
		type UpdateQuickwitConfigInput
	} from 'api/schemas';
	import type { IndexDetail } from 'api/types';
	import FieldMappingsEditor from './FieldMappingsEditor.svelte';
	import { fieldToMapping, type FieldRow, type IndexMode } from './index-form';

	let { detail }: { detail: IndexDetail } = $props();

	const initial = detail;
	let mode = $state<IndexMode>((initial.mode as IndexMode) ?? 'dynamic');
	let defaultSearchFields = $state<string[]>([...(initial.defaultSearchFields ?? [])]);
	let tagFields = $state<string[]>([...(initial.tagFields ?? [])]);
	let storeSource = $state(initial.storeSource ?? false);
	let indexFieldPresence = $state(initial.indexFieldPresence ?? false);
	let commitTimeoutSecs = $state(
		initial.commitTimeoutSecs != null ? String(initial.commitTimeoutSecs) : ''
	);
	let retentionEnabled = $state(initial.retention != null);
	let retentionPeriod = $state(initial.retention?.period ?? '');
	let retentionSchedule = $state(initial.retention?.schedule ?? '');
	let newFields = $state<FieldRow[]>([]);

	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	function buildInput(): UpdateQuickwitConfigInput {
		return {
			mode,
			defaultSearchFields: [...defaultSearchFields],
			tagFields: [...tagFields],
			storeSource,
			indexFieldPresence,
			commitTimeoutSecs: commitTimeoutSecs.trim() === '' ? null : Number(commitTimeoutSecs),
			retention: retentionEnabled
				? {
						period: retentionPeriod.trim(),
						...(retentionSchedule.trim() !== '' ? { schedule: retentionSchedule.trim() } : {})
					}
				: null,
			newFieldMappings: newFields.map(fieldToMapping)
		};
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};

		const parsed = v.safeParse(updateQuickwitConfigSchema, buildInput());
		if (!parsed.success) {
			fieldErrors = issuesToPathErrors(parsed.issues);
			toast.error('Please fix the highlighted fields.');
			return;
		}

		submitting = true;
		try {
			await updateQuickwitConfig(detail.indexId, parsed.output);
			toast.success('Index configuration updated');
			await invalidate(DEP.index(detail.indexId));
			await goto(`/settings/indexes/${encodeURIComponent(detail.indexId)}`);
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				toast.error(err.message);
			} else {
				toast.error(err instanceof Error ? err.message : 'Failed to update index configuration');
			}
		} finally {
			submitting = false;
		}
	}

	const fieldNameValidate = (value: string) =>
		value.trim() === '' ? 'Field name is required.' : null;
</script>

<form
	{onsubmit}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Immutable</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Quickwit forbids changing these after creation.
			</div>
		</div>
		<div class="flex flex-col gap-2 text-sm">
			<div class="flex flex-col gap-1">
				<span class="text-base-content/60 text-xs">Index ID</span>
				<input
					type="text"
					value={detail.indexId}
					class="input input-sm w-full font-mono"
					disabled
				/>
			</div>
			<div class="flex flex-col gap-1">
				<span class="text-base-content/60 text-xs">Index URI</span>
				<input
					type="text"
					value={detail.indexUri ?? '(default)'}
					class="input input-sm w-full"
					disabled
				/>
			</div>
			<div class="flex flex-col gap-1">
				<span class="text-base-content/60 text-xs">Timestamp field</span>
				<input
					type="text"
					value={detail.timestampField ?? ''}
					class="input input-sm w-full font-mono"
					disabled
				/>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Mode</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				How Quickwit handles fields not in the mapping.
			</div>
		</div>
		<div class="flex gap-4 text-sm">
			{#each INDEX_MODES as m (m)}
				<label class="flex items-center gap-2">
					<input type="radio" class="radio radio-sm" value={m} bind:group={mode} />
					{m}
				</label>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Default search fields</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Fields searched when a query has no field qualifier.
			</div>
		</div>
		<TagInput
			bind:tags={defaultSearchFields}
			placeholderEmpty="Add a field name…"
			addLabel="Add default search field"
			validate={fieldNameValidate}
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Tag fields</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Field values indexed as split tags for pruning.
			</div>
		</div>
		<TagInput
			bind:tags={tagFields}
			placeholderEmpty="Add a field name…"
			addLabel="Add tag field"
			validate={fieldNameValidate}
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Retention</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Delete splits older than the period. Disable to clear.
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={retentionEnabled} />
				Enable retention
			</label>
			{#if retentionEnabled}
				<div class="flex flex-wrap items-center gap-3">
					<input
						type="text"
						bind:value={retentionPeriod}
						class="input input-sm w-40"
						class:input-error={fieldErrors['retention.period']}
						placeholder="90 days"
						autocomplete="off"
						aria-label="Retention period"
					/>
					<input
						type="text"
						bind:value={retentionSchedule}
						class="input input-sm w-40"
						placeholder="daily (optional)"
						autocomplete="off"
						aria-label="Retention evaluation schedule"
					/>
				</div>
				{#if fieldErrors['retention.period']}
					<p class="text-error text-xs">{fieldErrors['retention.period']}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<label for="edit-commit" class="text-sm">Commit timeout (secs)</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				How long indexing waits before committing a split. Empty to clear.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="edit-commit"
				type="text"
				inputmode="numeric"
				bind:value={commitTimeoutSecs}
				class="input input-sm w-40"
				class:input-error={fieldErrors.commitTimeoutSecs}
				placeholder="60 (optional)"
				autocomplete="off"
				aria-invalid={fieldErrors.commitTimeoutSecs ? 'true' : undefined}
			/>
			{#if fieldErrors.commitTimeoutSecs}
				<p class="text-error text-xs">{fieldErrors.commitTimeoutSecs}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Store source</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Keep the original document JSON in the index.
			</div>
		</div>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={storeSource} />
			Store the source document
		</label>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Index field presence</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Track which fields exist per document so presence queries work.
			</div>
		</div>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={indexFieldPresence} />
			Index field presence
		</label>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Existing fields</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Read-only. Quickwit doesn't reindex existing data.
			</div>
		</div>
		<div class="border-line rounded-box divide-line max-h-64 divide-y overflow-auto border">
			{#each detail.fields as field (field.name)}
				<div class="flex items-center justify-between px-3 py-1.5 font-mono text-xs">
					<span class="break-all">{field.name}</span>
					<span class="text-base-content/60">{field.type}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[260px_1fr]">
		<div>
			<span class="text-sm">Add fields</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				New fields are appended. Applies only to newly indexed data.
			</div>
			{#if fieldErrors.newFieldMappings}
				<p class="text-error mt-1 text-xs">{fieldErrors.newFieldMappings}</p>
			{/if}
		</div>
		<div class="border-line rounded-box divide-line divide-y border">
			<FieldMappingsEditor
				bind:fields={newFields}
				timestampField={detail.timestampField ?? ''}
				{fieldErrors}
				minFields={0}
				errorPrefix="newFieldMappings"
				showSearchDefault={false}
			/>
		</div>
	</div>

	<div class="flex justify-end gap-2 px-4 py-3">
		<a href="/settings/indexes/{encodeURIComponent(detail.indexId)}" class="btn btn-ghost btn-sm">
			Cancel
		</a>
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
