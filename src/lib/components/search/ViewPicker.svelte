<script lang="ts">
	import Icon from '@iconify/svelte';
	import { ChevronDown, ListFilter, Search, Trash2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { deleteView } from '$lib/api/views.remote';
	import { BUILTIN_VIEWS } from '$lib/constants/builtin-views';
	import type { ActiveViewRef, BuiltinView, BuiltinViewIcon, ViewSummary } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		activeView,
		userViews,
		onApply,
		onClear,
		onSaveAsNew
	}: {
		activeView: BuiltinView | ViewSummary | null;
		userViews: ViewSummary[];
		onApply: (ref: ActiveViewRef) => void;
		onClear: () => void;
		onSaveAsNew: () => void;
	} = $props();

	let open = $state(false);
	let searchTerm = $state('');

	type ListItem =
		| { kind: 'builtin'; slug: string; name: string; icon: BuiltinViewIcon }
		| { kind: 'user'; id: number; name: string };

	const items = $derived<ListItem[]>([
		...BUILTIN_VIEWS.map((v) => ({
			kind: 'builtin' as const,
			slug: v.slug,
			name: v.name,
			icon: v.icon
		})),
		...userViews.map((v) => ({ kind: 'user' as const, id: v.id, name: v.name }))
	]);

	const filteredItems = $derived(
		searchTerm.trim() === ''
			? items
			: items.filter((i) => i.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
	);

	const activeBuiltin = $derived(activeView && 'slug' in activeView ? activeView : null);
	const activeUserView = $derived(activeView && 'id' in activeView ? activeView : null);

	function isItemActive(item: ListItem): boolean {
		if (item.kind === 'builtin') {
			return activeBuiltin?.slug === item.slug;
		}
		return activeUserView?.id === item.id;
	}

	function selectItem(item: ListItem) {
		open = false;
		searchTerm = '';
		if (item.kind === 'builtin') {
			onApply({ kind: 'builtin', slug: item.slug });
		} else {
			onApply({ kind: 'user', id: item.id });
		}
	}

	async function handleDelete(id: number, name: string) {
		if (!confirm(`Delete view "${name}"?`)) return;
		try {
			await deleteView({ id });
			toast.success('View deleted');
			await invalidateAll();
			if (activeUserView?.id === id) {
				onClear();
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete view'));
		}
	}

	function handleSaveAsNew() {
		open = false;
		searchTerm = '';
		onSaveAsNew();
	}

	function handleClear(e: MouseEvent) {
		e.stopPropagation();
		open = false;
		searchTerm = '';
		onClear();
	}
</script>

{#snippet builtinIcon(icon: BuiltinViewIcon)}
	{#if 'iconifyIcon' in icon}
		<Icon icon={icon.iconifyIcon} class="size-3.5 shrink-0" />
	{:else}
		<img src={icon.iconSrc} alt="" class="size-3.5 shrink-0" />
	{/if}
{/snippet}

{#if open}
	<div role="none" class="fixed inset-0 z-10" onclick={() => (open = false)}></div>
{/if}

<div class="dropdown" class:dropdown-open={open}>
	{#if activeView === null}
		<button
			type="button"
			class="btn justify-between btn-ghost btn-sm"
			onclick={() => (open = !open)}
		>
			<span class="flex items-center gap-1.5">
				<ListFilter size={14} />
				Views
			</span>
			<ChevronDown size={14} />
		</button>
	{:else}
		<div class="join">
			<button type="button" class="btn join-item btn-ghost btn-sm" onclick={() => (open = !open)}>
				<span class="flex items-center gap-1.5">
					{#if activeBuiltin}
						{@render builtinIcon(activeBuiltin.icon)}
					{:else}
						<ListFilter size={14} />
					{/if}
					{activeView.name}
				</span>
				<ChevronDown size={14} />
			</button>
			<button
				type="button"
				class="btn join-item btn-ghost btn-sm"
				aria-label="Clear active view"
				title="Clear active view"
				onclick={handleClear}
			>
				<X size={14} />
			</button>
		</div>
	{/if}

	{#if open}
		<div
			class="dropdown-content z-20 mt-1 w-72 rounded-box bg-base-100 p-3 shadow-lg ring-1 ring-base-300"
		>
			<div class="mb-2 flex items-center gap-2 px-1">
				<ListFilter size={14} class="text-base-content/60" />
				<span class="text-sm font-medium">Views</span>
			</div>

			<div class="relative mb-2">
				<Search size={12} class="absolute top-1/2 left-2 -translate-y-1/2 text-base-content/40" />
				<input
					type="text"
					placeholder="Search views..."
					class="input input-sm w-full pl-7"
					bind:value={searchTerm}
				/>
			</div>

			<div class="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
				{#each filteredItems as item (item.kind === 'builtin' ? `b:${item.slug}` : `u:${item.id}`)}
					<div class="flex items-center gap-1">
						<button
							class="btn flex-1 justify-start btn-ghost btn-sm {isItemActive(item)
								? 'btn-active'
								: ''}"
							onclick={() => selectItem(item)}
						>
							{#if item.kind === 'builtin'}
								{@render builtinIcon(item.icon)}
							{:else}
								<ListFilter size={14} class="text-base-content/40" />
							{/if}
							{item.name}
						</button>
						{#if item.kind === 'user'}
							<button
								class="btn btn-square text-error btn-ghost btn-xs"
								aria-label={`Delete ${item.name}`}
								onclick={() => handleDelete(item.id, item.name)}
							>
								<Trash2 size={12} />
							</button>
						{/if}
					</div>
				{/each}

				{#if filteredItems.length === 0 && searchTerm.trim() !== ''}
					<div class="px-2 py-2 text-xs text-base-content/50">No matches</div>
				{/if}
			</div>

			<div class="divider my-2"></div>

			<button class="btn justify-start text-primary btn-ghost btn-sm" onclick={handleSaveAsNew}>
				Save current as view…
			</button>
		</div>
	{/if}
</div>
