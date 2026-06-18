<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import { saveIndexConfig } from '$lib/api/indexes';
	import TagInput from '$lib/components/ui/TagInput.svelte';
	import { saveIndexConfigSchema, type SaveIndexConfigInput } from 'api/schemas';
	import type { IndexDetail, IndexVisibility } from 'api/types';

	let { detail }: { detail: IndexDetail } = $props();

	const initial = detail;
	let displayName = $state(initial.displayName ?? '');
	let visibility = $state<IndexVisibility>(initial.visibility);
	let levelField = $state(initial.levelField);
	let messageField = $state(initial.messageField);
	let tracebackField = $state(initial.tracebackField ?? '');
	let contextFieldTags = $state<string[]>([...(initial.contextFields ?? [])]);

	let submitting = $state(false);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};

		const payload: SaveIndexConfigInput = {
			displayName: displayName.trim() === '' ? null : displayName.trim(),
			visibility,
			levelField: levelField.trim(),
			messageField: messageField.trim(),
			tracebackField: tracebackField.trim() === '' ? null : tracebackField.trim(),
			contextFields: contextFieldTags.length === 0 ? null : [...contextFieldTags]
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
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				toast.error(err.message);
			} else {
				toast.error(err instanceof Error ? err.message : 'Failed to save config');
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
			<label for="cfg-display-name" class="text-sm">Display name</label>
			<div class="text-base-content/60 mt-0.5 text-xs">Friendly name shown to users in search.</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="cfg-display-name"
				type="text"
				bind:value={displayName}
				class="input input-sm w-full"
				class:input-error={fieldErrors.displayName}
				placeholder="e.g. Production Traces"
				autocomplete="off"
				aria-invalid={fieldErrors.displayName ? 'true' : undefined}
				aria-describedby={fieldErrors.displayName ? 'cfg-display-name-msg' : undefined}
			/>
			{#if fieldErrors.displayName}
				<p id="cfg-display-name-msg" class="text-error text-xs">{fieldErrors.displayName}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="cfg-visibility" class="text-sm">Visibility</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Who can see this index on the search page.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<select
				id="cfg-visibility"
				bind:value={visibility}
				class="select select-sm w-full"
				class:select-error={fieldErrors.visibility}
				aria-invalid={fieldErrors.visibility ? 'true' : undefined}
				aria-describedby={fieldErrors.visibility ? 'cfg-visibility-msg' : undefined}
			>
				<option value="all">Public — everyone</option>
				<option value="admin">Admins only</option>
				<option value="hidden">Hidden</option>
			</select>
			{#if fieldErrors.visibility}
				<p id="cfg-visibility-msg" class="text-error text-xs">{fieldErrors.visibility}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="cfg-level-field" class="text-sm">Level field</label>
			<div class="text-base-content/60 mt-0.5 text-xs">Field that carries the log severity.</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="cfg-level-field"
				type="text"
				bind:value={levelField}
				class="input input-sm w-full"
				class:input-error={fieldErrors.levelField}
				placeholder="level"
				autocomplete="off"
				aria-invalid={fieldErrors.levelField ? 'true' : undefined}
				aria-describedby={fieldErrors.levelField ? 'cfg-level-field-msg' : undefined}
			/>
			{#if fieldErrors.levelField}
				<p id="cfg-level-field-msg" class="text-error text-xs">{fieldErrors.levelField}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="cfg-message-field" class="text-sm">Message field</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				The primary human-readable message per row.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="cfg-message-field"
				type="text"
				bind:value={messageField}
				class="input input-sm w-full"
				class:input-error={fieldErrors.messageField}
				placeholder="message"
				autocomplete="off"
				aria-invalid={fieldErrors.messageField ? 'true' : undefined}
				aria-describedby={fieldErrors.messageField ? 'cfg-message-field-msg' : undefined}
			/>
			{#if fieldErrors.messageField}
				<p id="cfg-message-field-msg" class="text-error text-xs">{fieldErrors.messageField}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="cfg-traceback-field" class="text-sm">Traceback field</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Dot-notation path to stacktrace data. Optional.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<input
				id="cfg-traceback-field"
				type="text"
				bind:value={tracebackField}
				class="input input-sm w-full"
				class:input-error={fieldErrors.tracebackField}
				placeholder="e.g. message.traceback"
				autocomplete="off"
				aria-invalid={fieldErrors.tracebackField ? 'true' : undefined}
				aria-describedby={fieldErrors.tracebackField ? 'cfg-traceback-field-msg' : undefined}
			/>
			{#if fieldErrors.tracebackField}
				<p id="cfg-traceback-field-msg" class="text-error text-xs">{fieldErrors.tracebackField}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<div class="text-sm">Context fields</div>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Fields used for log context search. Leave empty to use all fields. Supports dot-notation.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<TagInput
				bind:tags={contextFieldTags}
				placeholderEmpty="service.name  (press Enter to add)"
				addLabel="Add context field"
				error={Boolean(fieldErrors.contextFields)}
			/>
			{#if fieldErrors.contextFields}
				<p class="text-error text-xs">{fieldErrors.contextFields}</p>
			{/if}
		</div>
	</div>

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
