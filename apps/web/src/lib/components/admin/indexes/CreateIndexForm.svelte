<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToPathErrors, toFieldErrors } from '$lib/api/errors';
	import { createIndex } from '$lib/api/indexes';
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import { createIndexSchema, INDEX_MODES } from 'api/schemas';
	import DynamicMappingFields from './DynamicMappingFields.svelte';
	import FieldMappingsEditor from './FieldMappingsEditor.svelte';
	import { emptyIndexForm, formToCreateInput } from './index-form';

	let form = $state(emptyIndexForm());
	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	const datetimeFields = $derived(
		form.fields
			.filter((f) => f.type === 'datetime' && f.name.trim() !== '')
			.map((f) => f.name.trim())
	);

	const effectiveTimestampField = $derived(
		datetimeFields.includes(form.timestampField) ? form.timestampField : (datetimeFields[0] ?? '')
	);

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};
		form.timestampField = effectiveTimestampField;

		const parsed = v.safeParse(createIndexSchema, formToCreateInput(form));
		if (!parsed.success) {
			fieldErrors = issuesToPathErrors(parsed.issues);
			toast.error('Please fix the highlighted fields.');
			return;
		}

		submitting = true;
		try {
			const created = await createIndex(parsed.output);
			toast.success('Index created');
			await invalidate(DEP.indexes);
			await goto(`/settings/indexes/${encodeURIComponent(created.indexId)}`);
		} catch (err) {
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				toast.error(err.message);
			} else {
				toast.error(err instanceof Error ? err.message : 'Failed to create index');
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
	<SettingsRow
		id="idx-id"
		label="Index ID"
		hint="Starts with a letter; 3–255 chars (letters, digits, - or _)."
		error={fieldErrors.indexId}
	>
		{#snippet children({ id, invalid, describedBy })}
			<input
				{id}
				type="text"
				bind:value={form.indexId}
				class="input input-sm w-full font-mono"
				class:input-error={invalid}
				placeholder="app-logs"
				autocomplete="off"
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
		{/snippet}
	</SettingsRow>

	<SettingsRow plain label="Mode" hint="How Quickwit handles fields not in the mapping.">
		<div class="flex flex-col gap-3">
			<div class="flex gap-4 text-sm">
				{#each INDEX_MODES as m (m)}
					<label class="flex items-center gap-2">
						<input type="radio" class="radio radio-sm" value={m} bind:group={form.mode} />
						{m}
					</label>
				{/each}
			</div>
			{#if form.mode === 'dynamic'}
				<div class="flex flex-col gap-1">
					<span class="text-base-content/60 text-xs">Unmapped fields are indexed as:</span>
					<DynamicMappingFields bind:dm={form.dynamic} />
				</div>
			{/if}
		</div>
	</SettingsRow>

	<SettingsRow
		id="idx-ts"
		label="Timestamp field"
		hint="Must be one of the datetime fields below. Stored as fast automatically."
		error={fieldErrors.timestampField}
	>
		{#snippet children({ id, invalid, describedBy })}
			<select
				{id}
				value={effectiveTimestampField}
				onchange={(e) => (form.timestampField = e.currentTarget.value)}
				class="select select-sm w-full"
				class:select-error={invalid}
				aria-invalid={invalid ? 'true' : undefined}
				aria-describedby={describedBy}
			>
				{#if datetimeFields.length === 0}
					<option value="" disabled selected>Add a datetime field first…</option>
				{/if}
				{#each datetimeFields as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		plain
		label="Fields"
		hint="At least one field. Options preselected to Quickwit defaults."
		error={fieldErrors.fieldMappings}
	>
		<div class="border-line rounded-box divide-line divide-y border">
			<FieldMappingsEditor
				bind:fields={form.fields}
				timestampField={effectiveTimestampField}
				{fieldErrors}
			/>
		</div>
	</SettingsRow>

	<SettingsRow
		plain
		label="Retention"
		hint="Delete splits older than the period. Optional."
		error={fieldErrors['retention.period']}
	>
		{#snippet children({ invalid })}
			<div class="flex flex-col gap-2">
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:checked={form.retentionEnabled}
					/>
					Enable retention
				</label>
				{#if form.retentionEnabled}
					<div class="flex flex-wrap items-center gap-3">
						<input
							type="text"
							bind:value={form.retentionPeriod}
							class="input input-sm w-40"
							class:input-error={invalid}
							placeholder="90 days"
							autocomplete="off"
							aria-label="Retention period"
						/>
						<input
							type="text"
							bind:value={form.retentionSchedule}
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
		id="idx-uri"
		label="Index URI"
		hint="Where splits are stored. Defaults to the configured index root. Optional."
	>
		{#snippet children({ id })}
			<input
				{id}
				type="text"
				bind:value={form.indexUri}
				class="input input-sm w-full"
				placeholder="s3://my-bucket/indexes/app-logs (optional)"
				autocomplete="off"
			/>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		id="idx-tags"
		label="Tag fields"
		hint="Field values indexed as split tags for pruning. One per line. Optional."
	>
		{#snippet children({ id })}
			<textarea
				{id}
				bind:value={form.tagFields}
				rows="2"
				class="textarea textarea-sm w-full font-mono"
				placeholder="one field name per line (optional)"
				autocomplete="off"
				spellcheck="false"></textarea>
		{/snippet}
	</SettingsRow>

	<SettingsRow
		id="idx-partition"
		label="Partition key"
		hint="Routes documents into separate splits by field value, e.g. tenant_id. Optional."
	>
		{#snippet children({ id })}
			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-1">
					<input
						{id}
						type="text"
						bind:value={form.partitionKey}
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
				{#if form.partitionKey.trim() !== ''}
					<div class="flex flex-col gap-1">
						<label for="idx-max-partitions" class="text-base-content/60 text-xs">
							Max partitions (default 200)
						</label>
						<input
							id="idx-max-partitions"
							type="text"
							inputmode="numeric"
							bind:value={form.maxNumPartitions}
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
		id="idx-commit"
		label="Commit timeout (secs)"
		hint="How long indexing waits before committing a split. Optional."
		error={fieldErrors.commitTimeoutSecs}
	>
		{#snippet children({ id, invalid, describedBy })}
			<input
				{id}
				type="text"
				inputmode="numeric"
				bind:value={form.commitTimeoutSecs}
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
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.storeSource} />
			Store the source document
		</label>
	</SettingsRow>

	<SettingsRow
		plain
		label="Index field presence"
		hint="Track which fields exist per document so presence queries work."
	>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.indexFieldPresence} />
			Index field presence
		</label>
	</SettingsRow>

	<div class="flex justify-end gap-2 px-4 py-3">
		<a href="/settings/indexes" class="btn btn-ghost btn-sm">Cancel</a>
		<button type="submit" class="btn btn-primary btn-sm" disabled={submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
				Creating…
			{:else}
				Create index
			{/if}
		</button>
	</div>
</form>
