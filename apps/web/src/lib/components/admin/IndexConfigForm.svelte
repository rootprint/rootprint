<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';
	import { X } from 'lucide-svelte';

	import { invalidate } from '$app/navigation';
	import { toFieldErrors } from '$lib/api/errors';
	import { client } from '$lib/api/client';
	import { saveIndexConfigSchema, type SaveIndexConfigInput } from 'api/schemas';
	import type { ApiErrorBody, IndexDetail, IndexVisibility } from 'api/types';

	let { detail }: { detail: IndexDetail } = $props();

	let displayName = $state('');
	let visibility = $state<IndexVisibility>('all');
	let levelField = $state('');
	let messageField = $state('');
	let tracebackField = $state('');
	let contextFieldTags = $state<string[]>([]);
	let contextFieldInput = $state('');

	let saving = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	$effect(() => {
		// Reset only when navigating to a different index. Reading the primitive
		// id is the only tracked dependency; Svelte short-circuits same-string
		// updates, so saves and unrelated invalidations don't wipe the form.
		void detail.indexId;
		untrack(() => {
			displayName = detail.displayName ?? '';
			visibility = detail.visibility;
			levelField = detail.levelField;
			messageField = detail.messageField;
			tracebackField = detail.tracebackField ?? '';
			contextFieldTags = detail.contextFields ?? [];
			contextFieldInput = '';
			formError = null;
			fieldErrors = {};
		});
	});

	function addContextField() {
		const value = contextFieldInput.trim();
		if (value && !contextFieldTags.includes(value)) {
			contextFieldTags = [...contextFieldTags, value];
		}
		contextFieldInput = '';
	}

	function removeContextField(field: string) {
		contextFieldTags = contextFieldTags.filter((f) => f !== field);
	}

	function handleContextFieldKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addContextField();
		} else if (e.key === 'Backspace' && contextFieldInput === '' && contextFieldTags.length > 0) {
			contextFieldTags = contextFieldTags.slice(0, -1);
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
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
			for (const issue of parsed.issues) {
				const key = issue.path?.[0]?.key as string | undefined;
				if (key) fieldErrors[key] = issue.message;
			}
			return;
		}

		saving = true;
		try {
			const res = await client.api.indexes[':indexId'].$patch({
				param: { indexId: detail.indexId },
				json: parsed.output
			});
			if (!res.ok) {
				const body = (await res.json()) as ApiErrorBody;
				fieldErrors = toFieldErrors(body);
				toast.error(body.error.message);
				return;
			}
			toast.success('Index configuration saved');
			await invalidate(`app:index:${detail.indexId}`);
		} finally {
			saving = false;
		}
	}
</script>

<form
	onsubmit={submit}
	class="hairline rounded-box bg-base-100 divide-base-content/10 flex flex-col divide-y"
>
	{#if formError}
		<div role="alert" class="alert alert-error mx-4 mt-4 text-sm">{formError}</div>
	{/if}

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<label for="cfg-display-name" class="text-sm">Display name</label>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Friendly name shown to users in search.
			</div>
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
			/>
			{#if fieldErrors.displayName}
				<p class="text-error font-mono text-xs">{fieldErrors.displayName}</p>
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
			>
				<option value="all">Public — everyone</option>
				<option value="admin">Admins only</option>
				<option value="hidden">Hidden</option>
			</select>
			{#if fieldErrors.visibility}
				<p class="text-error font-mono text-xs">{fieldErrors.visibility}</p>
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
			/>
			{#if fieldErrors.levelField}
				<p class="text-error font-mono text-xs">{fieldErrors.levelField}</p>
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
			/>
			{#if fieldErrors.messageField}
				<p class="text-error font-mono text-xs">{fieldErrors.messageField}</p>
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
			/>
			{#if fieldErrors.tracebackField}
				<p class="text-error font-mono text-xs">{fieldErrors.tracebackField}</p>
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
			<div
				class="border-base-content/10 focus-within:border-base-content bg-base-100 rounded-box flex flex-wrap items-center gap-1.5 border px-2 py-1.5 transition-colors"
				class:!border-error={fieldErrors.contextFields}
			>
				{#each contextFieldTags as field (field)}
					<span class="bg-base-200 flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs">
						{field}
						<button
							type="button"
							class="cursor-pointer opacity-50 hover:opacity-100"
							aria-label="Remove {field}"
							onclick={() => removeContextField(field)}
						>
							<X size={12} />
						</button>
					</span>
				{/each}
				<input
					type="text"
					bind:value={contextFieldInput}
					onkeydown={handleContextFieldKeydown}
					placeholder={contextFieldTags.length === 0
						? 'service.name  (press Enter to add)'
						: 'Add another…'}
					autocomplete="off"
					aria-label="Add context field"
					class="placeholder:text-base-content/40 min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
				/>
			</div>
			{#if fieldErrors.contextFields}
				<p class="text-error font-mono text-xs">{fieldErrors.contextFields}</p>
			{/if}
		</div>
	</div>

	<div class="flex justify-end px-4 py-3">
		<button type="submit" class="btn btn-primary btn-sm" disabled={saving}>
			{#if saving}
				<span class="loading loading-spinner loading-xs"></span>
				Saving…
			{:else}
				Save
			{/if}
		</button>
	</div>
</form>
