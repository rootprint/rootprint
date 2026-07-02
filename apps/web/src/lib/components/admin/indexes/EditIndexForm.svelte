<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToPathErrors, toFieldErrors } from '$lib/api/errors';
	import { updateQuickwitConfig } from '$lib/api/indexes';
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import {
		INDEX_MODES,
		updateQuickwitConfigSchema,
		type UpdateQuickwitConfigInput
	} from 'api/schemas';
	import type { IndexDetail } from 'api/types';
	import DynamicMappingFields from './DynamicMappingFields.svelte';
	import FieldMappingsEditor from './FieldMappingsEditor.svelte';
	import {
		fieldToMapping,
		toDynamicMappingForm,
		type DynamicMappingForm,
		type FieldRow,
		type IndexMode
	} from './index-form';

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
	let dynamic = $state<DynamicMappingForm>(toDynamicMappingForm(initial.dynamicMapping));
	let partitionKey = $state(initial.partitionKey ?? '');
	let maxNumPartitions = $state(
		initial.maxNumPartitions != null ? String(initial.maxNumPartitions) : ''
	);
	let newFields = $state<FieldRow[]>([]);

	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	function buildInput(): UpdateQuickwitConfigInput {
		return {
			mode,
			dynamicMapping: mode === 'dynamic' ? { ...dynamic } : null,
			partitionKey: partitionKey.trim() === '' ? null : partitionKey.trim(),
			maxNumPartitions:
				partitionKey.trim() === '' || maxNumPartitions.trim() === ''
					? null
					: Number(maxNumPartitions),
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
	<SettingsRow plain label="Immutable" hint="Quickwit forbids changing these after creation.">
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
	</SettingsRow>

	<SettingsRow plain label="Mode" hint="How Quickwit handles fields not in the mapping.">
		<div class="flex flex-col gap-3">
			<div class="flex gap-4 text-sm">
				{#each INDEX_MODES as m (m)}
					<label class="flex items-center gap-2">
						<input type="radio" class="radio radio-sm" value={m} bind:group={mode} />
						{m}
					</label>
				{/each}
			</div>
			{#if mode === 'dynamic'}
				<div class="flex flex-col gap-1">
					<span class="text-base-content/60 text-xs">Unmapped fields are indexed as:</span>
					<DynamicMappingFields bind:dm={dynamic} />
				</div>
			{/if}
		</div>
	</SettingsRow>

	<SettingsRow
		plain
		label="Default search fields"
		hint="Fields searched when a query has no field qualifier."
	>
		<TagInput
			bind:tags={defaultSearchFields}
			placeholderEmpty="Add a field name…"
			addLabel="Add default search field"
			validate={fieldNameValidate}
		/>
	</SettingsRow>

	<SettingsRow plain label="Tag fields" hint="Field values indexed as split tags for pruning.">
		<TagInput
			bind:tags={tagFields}
			placeholderEmpty="Add a field name…"
			addLabel="Add tag field"
			validate={fieldNameValidate}
		/>
	</SettingsRow>

	<SettingsRow
		id="edit-partition"
		label="Partition key"
		hint="Routes documents into separate splits by field value, e.g. tenant_id. Changes apply only to newly written splits. Empty to clear."
	>
		{#snippet children({ id })}
			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-1">
					<input
						{id}
						type="text"
						bind:value={partitionKey}
						class="input input-sm w-full font-mono"
						class:input-error={fieldErrors.partitionKey}
						placeholder="tenant_id or hash_mod(tenant_id, 50) (optional)"
						autocomplete="off"
						aria-invalid={fieldErrors.partitionKey ? 'true' : undefined}
					/>
					{#if fieldErrors.partitionKey}
						<p class="text-error text-xs">{fieldErrors.partitionKey}</p>
					{/if}
				</div>
				{#if partitionKey.trim() !== ''}
					<div class="flex flex-col gap-1">
						<label for="edit-max-partitions" class="text-base-content/60 text-xs">
							Max partitions (default 200)
						</label>
						<input
							id="edit-max-partitions"
							type="text"
							inputmode="numeric"
							bind:value={maxNumPartitions}
							class="input input-sm w-40"
							class:input-error={fieldErrors.maxNumPartitions}
							placeholder="200"
							autocomplete="off"
							aria-invalid={fieldErrors.maxNumPartitions ? 'true' : undefined}
						/>
						{#if fieldErrors.maxNumPartitions}
							<p class="text-error text-xs">{fieldErrors.maxNumPartitions}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		plain
		label="Retention"
		hint="Delete splits older than the period. Disable to clear."
		error={fieldErrors['retention.period']}
	>
		{#snippet children({ invalid })}
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
							class:input-error={invalid}
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
				{/if}
			</div>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		id="edit-commit"
		label="Commit timeout (secs)"
		hint="How long indexing waits before committing a split. Empty to clear."
		error={fieldErrors.commitTimeoutSecs}
	>
		{#snippet children({ id, invalid, describedBy })}
			<input
				{id}
				type="text"
				inputmode="numeric"
				bind:value={commitTimeoutSecs}
				class="input input-sm w-40"
				class:input-error={invalid}
				placeholder="60 (optional)"
				autocomplete="off"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
		{/snippet}
	</SettingsRow>

	<SettingsRow plain label="Store source" hint="Keep the original document JSON in the index.">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={storeSource} />
			Store the source document
		</label>
	</SettingsRow>

	<SettingsRow
		plain
		label="Index field presence"
		hint="Track which fields exist per document so presence queries work."
	>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={indexFieldPresence} />
			Index field presence
		</label>
	</SettingsRow>

	<SettingsRow
		plain
		label="Existing fields"
		hint="Read-only. Quickwit doesn't reindex existing data."
	>
		<div class="border-line rounded-box divide-line max-h-64 divide-y overflow-auto border">
			{#each detail.fields as field (field.name)}
				<div class="flex items-center justify-between gap-3 px-3 py-1.5 font-mono text-xs">
					<div class="flex min-w-0 flex-col">
						<span class="break-all">{field.name}</span>
						{#if field.description}
							<span class="text-base-content/50 break-all">{field.description}</span>
						{/if}
					</div>
					<span class="text-base-content/60">{field.type}</span>
				</div>
			{/each}
		</div>
	</SettingsRow>

	<SettingsRow
		plain
		label="Add fields"
		hint="New fields are appended. Applies only to newly indexed data."
		error={fieldErrors.newFieldMappings}
	>
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
	</SettingsRow>

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
