<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToPathErrors, toFieldErrors } from '$lib/api/errors';
	import { createIndex } from '$lib/api/indexes';
	import { createIndexSchema, INDEX_MODES } from 'api/schemas';
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
	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="idx-id" class="text-sm">Index ID</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Starts with a letter; 3–255 chars (letters, digits, - or _).
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="idx-id"
				type="text"
				bind:value={form.indexId}
				class="input input-sm w-full font-mono"
				class:input-error={fieldErrors.indexId}
				placeholder="app-logs"
				autocomplete="off"
				aria-invalid={fieldErrors.indexId ? 'true' : undefined}
			/>
			{#if fieldErrors.indexId}
				<p class="text-error text-xs">{fieldErrors.indexId}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<span class="text-sm">Mode</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				How Quickwit handles fields not in the mapping.
			</div>
		</div>
		<div class="flex gap-4 text-sm">
			{#each INDEX_MODES as m (m)}
				<label class="flex items-center gap-2">
					<input type="radio" class="radio radio-sm" value={m} bind:group={form.mode} />
					{m}
				</label>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="idx-ts" class="text-sm">Timestamp field</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Must be one of the datetime fields below. Stored as fast automatically.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<select
				id="idx-ts"
				value={effectiveTimestampField}
				onchange={(e) => (form.timestampField = e.currentTarget.value)}
				class="select select-sm w-full"
				class:select-error={fieldErrors.timestampField}
			>
				{#if datetimeFields.length === 0}
					<option value="" disabled selected>Add a datetime field first…</option>
				{/if}
				{#each datetimeFields as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
			{#if fieldErrors.timestampField}
				<p class="text-error text-xs">{fieldErrors.timestampField}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<span class="text-sm">Fields</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				At least one field. Options preselected to Quickwit defaults.
			</div>
			{#if fieldErrors.fieldMappings}
				<p class="text-error mt-1 text-xs">{fieldErrors.fieldMappings}</p>
			{/if}
		</div>
		<div class="border-line rounded-box divide-line divide-y border">
			<FieldMappingsEditor
				bind:fields={form.fields}
				timestampField={effectiveTimestampField}
				{fieldErrors}
			/>
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<span class="text-sm">Retention</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Delete splits older than the period. Optional.
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.retentionEnabled} />
				Enable retention
			</label>
			{#if form.retentionEnabled}
				<div class="flex flex-wrap items-center gap-3">
					<input
						type="text"
						bind:value={form.retentionPeriod}
						class="input input-sm w-40"
						class:input-error={fieldErrors['retention.period']}
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
				{#if fieldErrors['retention.period']}
					<p class="text-error text-xs">{fieldErrors['retention.period']}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="idx-uri" class="text-sm">Index URI</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Where splits are stored. Defaults to the configured index root. Optional.
			</div>
		</div>
		<input
			id="idx-uri"
			type="text"
			bind:value={form.indexUri}
			class="input input-sm w-full"
			placeholder="s3://my-bucket/indexes/app-logs (optional)"
			autocomplete="off"
		/>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="idx-tags" class="text-sm">Tag fields</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Field values indexed as split tags for pruning. One per line. Optional.
			</div>
		</div>
		<textarea
			id="idx-tags"
			bind:value={form.tagFields}
			rows="2"
			class="textarea textarea-sm w-full font-mono"
			placeholder="one field name per line (optional)"
			autocomplete="off"
			spellcheck="false"
		></textarea>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="idx-commit" class="text-sm">Commit timeout (secs)</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				How long indexing waits before committing a split. Optional.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="idx-commit"
				type="text"
				inputmode="numeric"
				bind:value={form.commitTimeoutSecs}
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

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<span class="text-sm">Store source</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Keep the original document JSON in the index.
			</div>
		</div>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.storeSource} />
			Store the source document
		</label>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<span class="text-sm">Index field presence</span>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Track which fields exist per document so presence queries work.
			</div>
		</div>
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={form.indexFieldPresence} />
			Index field presence
		</label>
	</div>

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
