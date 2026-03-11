<script lang="ts">
	import Icon from '@iconify/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import { getIndexConfig, saveIndexConfig } from '$lib/api/indexes.remote';

	let { indexId }: { indexId: string } = $props();

	let expanded = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let loaded = $state(false);
	let levelField = $state('level');
	let timestampField = $state('timestamp');
	let messageField = $state('message');

	async function toggle() {
		expanded = !expanded;
		if (expanded && !loaded) {
			loading = true;
			try {
				const config = await getIndexConfig(indexId);
				levelField = config.levelField;
				timestampField = config.timestampField;
				messageField = config.messageField;
				loaded = true;
			} catch (e) {
				toast.error(getErrorMessage(e, 'Failed to load config'));
				expanded = false;
			} finally {
				loading = false;
			}
		}
	}

	async function save() {
		saving = true;
		try {
			await saveIndexConfig({
				indexName: indexId,
				levelField,
				timestampField,
				messageField
			});
			toast.success('Configuration saved');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to save config'));
		} finally {
			saving = false;
		}
	}
</script>

<div class="border border-base-300 bg-base-100">
	<button class="flex w-full items-center gap-2 px-3 py-3 text-left" onclick={toggle}>
		<Icon
			icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'}
			width="14"
			height="14"
			class="text-base-content/40"
		/>
		<span class="text-sm font-medium">{indexId}</span>
	</button>

	{#if expanded}
		<div class="border-t border-base-300 px-3 py-3">
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<div class="flex items-end gap-2">
					<label class="floating-label flex-1">
						<span>Level Field</span>
						<input
							type="text"
							class="input-bordered input input-sm w-full"
							bind:value={levelField}
						/>
					</label>
					<label class="floating-label flex-1">
						<span>Timestamp Field</span>
						<input
							type="text"
							class="input-bordered input input-sm w-full"
							bind:value={timestampField}
						/>
					</label>
					<label class="floating-label flex-1">
						<span>Message Field</span>
						<input
							type="text"
							class="input-bordered input input-sm w-full"
							bind:value={messageField}
						/>
					</label>
					<button class="btn btn-sm btn-primary" onclick={save} disabled={saving}>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
