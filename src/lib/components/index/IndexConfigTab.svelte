<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { saveIndexConfig } from '$lib/api/indexes.remote';
	import type { AdminIndexDetail } from '$lib/types';

	let { detail }: { detail: AdminIndexDetail } = $props();

	const configForm = $derived(saveIndexConfig.for(detail.indexId));

	// Full form reset when switching indexes
	$effect(() => {
		const id = detail.indexId;
		untrack(() => {
			configForm.fields.set({
				indexId: id,
				displayName: detail.displayName ?? '',
				levelField: detail.levelField ?? 'level',
				messageField: detail.messageField ?? 'message',
				tracebackField: detail.tracebackField ?? '',
				visibility: (detail.visibility as 'hidden' | 'admin' | 'all') ?? 'all',
				contextFields: contextFieldsSerialized
			});
			contextFieldTags = Array.isArray(detail.contextFields)
				? (detail.contextFields as string[])
				: [];
		});
	});

	// Sync only contextFields when tags change (without resetting other fields)
	$effect(() => {
		const serialized = contextFieldsSerialized;
		untrack(() => {
			configForm.fields.contextFields.set(serialized);
		});
	});

	let contextFieldTags = $state<string[]>(
		Array.isArray(detail.contextFields) ? (detail.contextFields as string[]) : []
	);
	let contextFieldInput = $state('');
	const contextFieldsSerialized = $derived(JSON.stringify(contextFieldTags));

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

	let visibility = $state<'hidden' | 'admin' | 'all'>(
		(detail.visibility as 'hidden' | 'admin' | 'all') ?? 'all'
	);
	let adminVisible = $derived(visibility !== 'hidden');
	let memberVisible = $derived(visibility === 'all');

	function setVisibility(admin: boolean, member: boolean) {
		if (member) {
			visibility = 'all';
		} else if (admin) {
			visibility = 'admin';
		} else {
			visibility = 'hidden';
		}
		configForm.fields.visibility.set(visibility);
	}
</script>

<h2 class="mb-1 text-xl font-semibold">Index Configuration</h2>
<p class="mb-4 text-xs text-base-content/50">Map Quickwit fields to Logwiz display roles</p>
<form
	{...configForm.enhance(async ({ submit }) => {
		try {
			await submit();
			toast.success('Index configuration saved');
		} catch {
			toast.error('Failed to save configuration');
		}
	})}
	class="flex flex-col gap-4"
>
	<input {...configForm.fields.indexId.as('hidden', detail.indexId)} />
	<div>
		<label class="mb-1 block text-xs font-medium" for="displayName">Display Name</label>
		<input
			{...configForm.fields.displayName.as('text')}
			id="displayName"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. Production Logs"
		/>
		<p class="mt-1 text-[10px] text-base-content/40">
			Friendly name shown to users. Leave empty to use the index ID.
		</p>
	</div>
	<input {...configForm.fields.visibility.as('hidden', visibility)} />
	<div class="rounded-lg border border-base-300 p-3">
		<label class="mb-2 block text-xs font-medium">Search Visibility</label>
		<div class="flex gap-4">
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					class="checkbox checkbox-xs checkbox-accent"
					checked={adminVisible}
					onchange={(e) => {
						const checked = e.currentTarget.checked;
						if (!checked) setVisibility(false, false);
						else setVisibility(true, memberVisible);
					}}
				/>
				Admin
			</label>
			<label class="flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					class="checkbox checkbox-xs checkbox-accent"
					checked={memberVisible}
					onchange={(e) => {
						const checked = e.currentTarget.checked;
						if (checked) setVisibility(true, true);
						else setVisibility(adminVisible, false);
					}}
				/>
				Member
			</label>
		</div>
		<p class="mt-1 text-[10px] text-base-content/40">
			Controls who can see this index on the search page. Unchecking both hides it from search
			entirely.
		</p>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium" for="levelField">Level Field</label>
		<input
			{...configForm.fields.levelField.as('text')}
			id="levelField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. level, severity"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium" for="messageField"> Message Field </label>
		<input
			{...configForm.fields.messageField.as('text')}
			id="messageField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. message, body.message"
		/>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium" for="tracebackField"> Traceback Field </label>
		<input
			{...configForm.fields.tracebackField.as('text')}
			id="tracebackField"
			class="input-bordered input input-sm w-full"
			placeholder="e.g. message.traceback, attributes.exception.stacktrace"
		/>
		<p class="mt-1 text-[10px] text-base-content/40">
			Dot-notation path to the field containing stacktrace/traceback data
		</p>
	</div>
	<div>
		<label class="mb-1 block text-xs font-medium">Context Fields</label>
		<input {...configForm.fields.contextFields.as('hidden', contextFieldsSerialized)} />
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each contextFieldTags as field (field)}
				<span class="badge gap-1 badge-ghost font-mono text-xs badge-sm">
					{field}
					<button
						type="button"
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
		<p class="mt-1 text-[10px] text-base-content/40">
			Fields used for log context search. Leave empty to use all fields. Supports dot-notation for
			nested fields.
		</p>
	</div>
	<div>
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
