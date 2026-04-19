<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { saveIndexConfig } from '$lib/api/indexes.remote';
	import type { AdminIndexDetail } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	type Visibility = 'hidden' | 'admin' | 'all';

	let { detail }: { detail: AdminIndexDetail } = $props();

	const configForm = $derived(saveIndexConfig.for(detail.indexId));

	let visibility = $state<Visibility>((detail.visibility as Visibility) ?? 'all');
	let contextFieldTags = $state<string[]>(
		Array.isArray(detail.contextFields) ? (detail.contextFields as string[]) : []
	);
	let contextFieldInput = $state('');

	const contextFieldsSerialized = $derived(JSON.stringify(contextFieldTags));
	const adminVisible = $derived(visibility !== 'hidden');
	const memberVisible = $derived(visibility === 'all');

	// Reset form state when switching indexes.
	$effect(() => {
		const id = detail.indexId;
		untrack(() => {
			const nextVisibility = (detail.visibility as Visibility) ?? 'all';
			const nextTags = Array.isArray(detail.contextFields)
				? (detail.contextFields as string[])
				: [];
			configForm.fields.set({
				indexId: id,
				displayName: detail.displayName ?? '',
				levelField: detail.levelField ?? 'level',
				messageField: detail.messageField ?? 'message',
				tracebackField: detail.tracebackField ?? '',
				visibility: nextVisibility,
				contextFields: JSON.stringify(nextTags)
			});
			visibility = nextVisibility;
			contextFieldTags = nextTags;
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
		}
	}

	function setAdminVisible(checked: boolean) {
		visibility = checked ? (memberVisible ? 'all' : 'admin') : 'hidden';
	}

	function setMemberVisible(checked: boolean) {
		if (checked) visibility = 'all';
		else if (visibility === 'all') visibility = 'admin';
	}
</script>

<section>
	<p class="mb-3 text-sm text-base-content/60">
		Display, visibility, and field mappings for this index.
	</p>
	<form
		{...configForm.enhance(async ({ submit }) => {
			try {
				await submit();
				toast.success('Index configuration saved');
			} catch (e) {
				toast.error(getErrorMessage(e, 'Failed to save configuration'));
			}
		})}
		class="rounded-box border border-base-300 bg-base-100"
	>
		<input {...configForm.fields.indexId.as('hidden', detail.indexId)} />
		<input {...configForm.fields.visibility.as('hidden', visibility)} />
		<input {...configForm.fields.contextFields.as('hidden', contextFieldsSerialized)} />

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<label for="cfg-display-name" class="text-sm font-medium">Display name</label>
				<div class="mt-0.5 text-xs text-base-content/60">
					Friendly name shown to users in search.
				</div>
			</div>
			<div>
				<input
					{...configForm.fields.displayName.as('text')}
					id="cfg-display-name"
					class="input-bordered input input-sm w-full"
					placeholder="e.g. Production Traces"
				/>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<div class="text-sm font-medium">Search visibility</div>
				<div class="mt-0.5 text-xs text-base-content/60">
					Who can see this index on the search page. Uncheck both to hide entirely.
				</div>
			</div>
			<div>
				<div class="flex gap-4">
					<label class="flex items-center gap-2 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={adminVisible}
							onchange={(e) => setAdminVisible(e.currentTarget.checked)}
						/>
						Admin
					</label>
					<label class="flex items-center gap-2 text-xs">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={memberVisible}
							onchange={(e) => setMemberVisible(e.currentTarget.checked)}
						/>
						Member
					</label>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<label for="cfg-level-field" class="text-sm font-medium">Level field</label>
				<div class="mt-0.5 text-xs text-base-content/60">Field that carries the log severity.</div>
			</div>
			<div>
				<input
					{...configForm.fields.levelField.as('text')}
					id="cfg-level-field"
					class="input-bordered input input-sm w-full"
					placeholder="level"
				/>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<label for="cfg-message-field" class="text-sm font-medium">Message field</label>
				<div class="mt-0.5 text-xs text-base-content/60">
					The primary human-readable message per row.
				</div>
			</div>
			<div>
				<input
					{...configForm.fields.messageField.as('text')}
					id="cfg-message-field"
					class="input-bordered input input-sm w-full"
					placeholder="message"
				/>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<label for="cfg-traceback-field" class="text-sm font-medium">Traceback field</label>
				<div class="mt-0.5 text-xs text-base-content/60">
					Dot-notation path to stacktrace data. Optional.
				</div>
			</div>
			<div>
				<input
					{...configForm.fields.tracebackField.as('text')}
					id="cfg-traceback-field"
					class="input-bordered input input-sm w-full"
					placeholder="e.g. message.traceback, attributes.exception.stacktrace"
				/>
			</div>
		</div>

		<div class="grid grid-cols-[260px_1fr] gap-6 border-b border-base-300 px-4 py-4">
			<div>
				<div class="text-sm font-medium">Context fields</div>
				<div class="mt-0.5 text-xs text-base-content/60">
					Fields used for log context search. Leave empty to use all fields. Supports dot-notation
					for nested fields.
				</div>
			</div>
			<div>
				<div class="mb-2 flex flex-wrap gap-1.5">
					{#each contextFieldTags as field (field)}
						<span class="badge gap-1 badge-ghost font-mono text-xs badge-sm">
							{field}
							<button
								type="button"
								aria-label="Remove {field}"
								class="cursor-pointer text-error"
								onclick={() => removeContextField(field)}>&times;</button
							>
						</span>
					{/each}
				</div>
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={contextFieldInput}
						onkeydown={handleContextFieldKeydown}
						class="input-bordered input input-sm flex-1"
						placeholder="e.g. service.name, attributes.environment"
					/>
					<button type="button" class="btn btn-ghost btn-sm" onclick={addContextField}>Add</button>
				</div>
			</div>
		</div>

		<div class="flex justify-end border-t border-base-300 px-4 py-3">
			<button class="btn btn-sm btn-accent" disabled={!!configForm.pending}>
				{#if configForm.pending}
					<span class="loading loading-xs loading-spinner"></span>
					Saving...
				{:else}
					Save
				{/if}
			</button>
		</div>
	</form>
</section>
