<script lang="ts">
	import {
		AlertTriangle,
		Loader,
		MoreHorizontal,
		Power,
		PowerOff,
		RefreshCw,
		Trash2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { resetSourceCheckpoint, setSourceEnabled } from '$lib/api/indexes.remote';
	import type { QuickwitSource } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		indexId,
		source,
		onRequestDelete
	}: {
		indexId: string;
		source: QuickwitSource;
		onRequestDelete: () => void;
	} = $props();

	let toggling = $state(false);
	let resetting = $state(false);
	let resetArmed = $state(false);

	async function handleToggle() {
		toggling = true;
		const next = !source.enabled;
		try {
			await setSourceEnabled({ indexId, sourceId: source.sourceId, enabled: next });
			toast.success(
				next ? `Source ${source.sourceId} enabled` : `Source ${source.sourceId} disabled`
			);
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to update source'));
		} finally {
			toggling = false;
			resetArmed = false;
		}
	}

	async function handleReset() {
		if (!resetArmed) {
			resetArmed = true;
			return;
		}
		resetting = true;
		try {
			await resetSourceCheckpoint({ indexId, sourceId: source.sourceId });
			toast.success(`Checkpoint reset for ${source.sourceId}`);
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to reset checkpoint'));
		} finally {
			resetting = false;
			resetArmed = false;
		}
	}

	function handleDelete() {
		resetArmed = false;
		onRequestDelete();
	}
</script>

<div class="dropdown dropdown-end">
	<button
		tabindex="0"
		class="btn btn-square btn-ghost btn-sm"
		aria-label="Actions for source {source.sourceId}"
	>
		<MoreHorizontal size={16} />
	</button>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<ul
		tabindex="0"
		class="dropdown-content menu z-10 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow"
		onfocusout={(e) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resetArmed = false;
		}}
	>
		<li>
			<button type="button" onclick={handleToggle} disabled={toggling}>
				{#if toggling}
					<Loader size={14} class="animate-spin" />
				{:else if source.enabled}
					<PowerOff size={14} />
				{:else}
					<Power size={14} />
				{/if}
				<span>{source.enabled ? 'Disable source' : 'Enable source'}</span>
			</button>
		</li>

		<li>
			<button
				type="button"
				class={resetArmed ? 'text-warning' : ''}
				onclick={handleReset}
				disabled={resetting}
			>
				{#if resetting}
					<Loader size={14} class="animate-spin" />
				{:else if resetArmed}
					<AlertTriangle size={14} />
				{:else}
					<RefreshCw size={14} />
				{/if}
				<span>{resetArmed ? 'Confirm reset' : 'Reset checkpoint'}</span>
			</button>
		</li>

		<li><hr class="my-1 border-base-300" /></li>

		<li>
			<button type="button" class="text-error" onclick={handleDelete}>
				<Trash2 size={14} />
				<span>Delete source</span>
			</button>
		</li>
	</ul>
</div>
