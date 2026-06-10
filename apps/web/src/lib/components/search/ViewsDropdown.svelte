<script lang="ts">
	import {
		ArrowLeft,
		ChevronDown,
		Eye,
		Layers,
		Pencil,
		Plus,
		RefreshCw,
		Search,
		Trash2
	} from 'lucide-svelte';
	import { listViews, createView, updateView, deleteView, ViewError } from '$lib/api/views';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import type { SavedView } from 'api/types';

	let { store }: { store: SearchStore } = $props();

	let items = $state<SavedView[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	let details = $state<HTMLDetailsElement | null>(null);
	let filterText = $state('');

	let toDelete = $state<SavedView | null>(null);
	let deleteModalOpen = $state(false);
	let deleting = $state(false);

	let toOverwrite = $state<SavedView | null>(null);
	let overwriteModalOpen = $state(false);
	let overwriting = $state(false);

	type Panel = 'list' | 'form';

	let panel = $state<Panel>('list');
	let editing = $state<SavedView | null>(null);
	let formName = $state('');
	let formDescription = $state('');
	let formError = $state<string | null>(null);
	let formNameError = $state<string | null>(null);
	let formSubmitting = $state(false);

	// Empty activeFields means "server defaults" — store null so applying the
	// view never freezes an empty column list into the user's preferences.
	function currentSnapshot() {
		return {
			query: store.query,
			filters: store.filters,
			sortDirection: store.sortDirection,
			columns: store.activeFields.length > 0 ? store.activeFields : null
		};
	}

	async function refresh() {
		const indexId = store.selectedIndex;
		if (indexId === null) {
			items = [];
			error = 'No index selected';
			return;
		}
		loading = true;
		error = null;
		try {
			items = await listViews(indexId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load views';
			items = [];
		} finally {
			loading = false;
		}
	}

	function applyView(item: SavedView) {
		store.navigateQuery(
			{ query: item.query, filters: item.filters, sortDirection: item.sortDirection },
			{ push: true }
		);
		if (item.columns !== null) store.setActiveFields([...item.columns]);
		close();
	}

	function openNewForm(prefillName = '') {
		editing = null;
		formName = prefillName;
		formDescription = '';
		formError = null;
		formNameError = null;
		panel = 'form';
	}

	function openEditForm(item: SavedView) {
		editing = item;
		formName = item.name;
		formDescription = item.description ?? '';
		formError = null;
		formNameError = null;
		panel = 'form';
	}

	function backToList() {
		panel = 'list';
		editing = null;
		formError = null;
		formNameError = null;
	}

	const formCanSave = $derived.by(() => {
		if (formSubmitting) return false;
		if (formName.trim().length === 0) return false;
		if (!editing) return true;
		const nameChanged = formName !== editing.name;
		const descChanged = formDescription !== (editing.description ?? '');
		return nameChanged || descChanged;
	});

	async function submitForm() {
		if (!formCanSave) return;
		const indexId = store.selectedIndex;
		if (indexId === null) {
			formError = 'No index selected';
			return;
		}
		formSubmitting = true;
		formError = null;
		formNameError = null;
		try {
			if (editing) {
				const patch: { name?: string; description?: string | null } = {};
				if (formName !== editing.name) patch.name = formName;
				if (formDescription !== (editing.description ?? '')) {
					patch.description = formDescription === '' ? null : formDescription;
				}
				const row = await updateView(indexId, editing.id, patch);
				items = items.map((it) => (it.id === row.id ? row : it));
			} else {
				const row = await createView(indexId, {
					name: formName,
					description: formDescription === '' ? undefined : formDescription,
					...currentSnapshot()
				});
				items = [row, ...items];
			}
			backToList();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to save view';
			const code = e instanceof ViewError ? e.code : undefined;
			if (code === 'VIEW_NAME_TAKEN') {
				formNameError = message;
			} else {
				formError = message;
			}
		} finally {
			formSubmitting = false;
		}
	}

	function openOverwriteModal(item: SavedView) {
		toOverwrite = item;
		overwriteModalOpen = true;
	}

	async function confirmOverwrite() {
		const item = toOverwrite;
		if (!item) return;
		const indexId = store.selectedIndex;
		if (indexId === null) {
			error = 'No index selected';
			overwriteModalOpen = false;
			return;
		}
		overwriting = true;
		error = null;
		try {
			const row = await updateView(indexId, item.id, currentSnapshot());
			items = items.map((it) => (it.id === row.id ? row : it));
			overwriteModalOpen = false;
			toOverwrite = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update view';
			overwriteModalOpen = false;
		} finally {
			overwriting = false;
		}
	}

	function openDeleteModal(item: SavedView) {
		toDelete = item;
		deleteModalOpen = true;
	}

	async function confirmDelete() {
		const item = toDelete;
		if (!item) return;
		const indexId = store.selectedIndex;
		if (indexId === null) {
			error = 'No index selected';
			deleteModalOpen = false;
			return;
		}
		deleting = true;
		error = null;
		try {
			await deleteView(indexId, item.id);
			items = items.filter((it) => it.id !== item.id);
			deleteModalOpen = false;
			toDelete = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete view';
			deleteModalOpen = false;
		} finally {
			deleting = false;
		}
	}

	function close() {
		if (details) details.open = false;
	}

	function onToggle() {
		if (details?.open) {
			refresh();
		} else {
			filterText = '';
			panel = 'list';
			editing = null;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && details?.open) close();
	}

	function onWindowClick(e: MouseEvent) {
		if (!details?.open) return;
		// `composedPath()` captures the event path at dispatch time, so it still
		// resolves correctly when the click originated on an element that Svelte
		// re-rendered out of the DOM (e.g. the footer button flipping `panel` to
		// `'form'` removes the button before the window listener runs).
		if (details && e.composedPath().includes(details)) return;
		close();
	}

	const filtered = $derived.by(() => {
		const q = filterText.trim().toLowerCase();
		if (!q) return items;
		return items.filter((item) => {
			const name = item.name.toLowerCase();
			const desc = (item.description ?? '').toLowerCase();
			return name.includes(q) || desc.includes(q);
		});
	});

	let lastIndex: string | null | undefined;
	$effect(() => {
		const current = store.selectedIndex;
		if (lastIndex !== undefined && current !== lastIndex) close();
		lastIndex = current;
	});
</script>

<svelte:window onkeydown={onKeydown} onclick={onWindowClick} />

<details bind:this={details} ontoggle={onToggle} class="dropdown">
	<summary title="Views" class="btn btn-sm btn-ghost list-none">
		<Layers class="h-3.5 w-3.5" />
		Views
		<ChevronDown class="h-3 w-3 opacity-60" />
	</summary>

	<div
		class="dropdown-content border-line rounded-box bg-base-100 z-50 mt-1 flex w-80 flex-col border"
	>
		{#if panel === 'list'}
			<div class="border-line border-b px-3 pt-3 pb-2">
				<p class="eyebrow">Views</p>
			</div>

			<div class="border-line border-b px-3 py-2">
				<label class="input input-sm flex items-center gap-2">
					<Search class="h-3.5 w-3.5 opacity-60" />
					<input type="text" class="grow" placeholder="Search views…" bind:value={filterText} />
				</label>
			</div>

			<div class="max-h-72 min-h-[6rem] flex-1 overflow-y-auto">
				{#if error && items.length > 0}
					<p class="text-error border-line border-b px-3 py-2 text-xs">{error}</p>
				{/if}
				{#if loading && items.length === 0}
					<div class="text-base-content/60 flex h-24 items-center justify-center gap-2 text-xs">
						<span class="loading loading-spinner loading-xs"></span>
						Loading…
					</div>
				{:else if error && items.length === 0}
					<div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
						<p class="text-error text-xs">{error}</p>
						<button type="button" class="btn btn-ghost btn-xs" onclick={() => refresh()}>
							Retry
						</button>
					</div>
				{:else if items.length === 0}
					<div class="flex h-full items-center justify-center p-3">
						<p class="text-base-content/60 text-xs">No views yet</p>
					</div>
				{:else if filtered.length === 0}
					<div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
						<p class="text-base-content/60 text-xs">No matches.</p>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							onclick={() => openNewForm(filterText)}
						>
							<Plus class="h-3.5 w-3.5" />
							Save as "{filterText}"
						</button>
					</div>
				{:else}
					<ul class="py-1">
						{#each filtered as item (item.id)}
							<li>
								<div class="group hover:bg-base-200 flex items-center">
									<button
										type="button"
										class="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left"
										onclick={() => applyView(item)}
										title={item.description ?? item.query}
									>
										<Eye class="h-3.5 w-3.5 shrink-0 opacity-60" />
										<span class="flex min-w-0 flex-col">
											<span class="truncate text-xs">{item.name}</span>
											{#if item.description}
												<span class="text-base-content/60 truncate text-[10px]">
													{item.description}
												</span>
											{/if}
										</span>
									</button>
									<div
										class="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
									>
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square"
											aria-label="Update with current search"
											title="Update with current search"
											onclick={() => openOverwriteModal(item)}
										>
											<RefreshCw class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square"
											aria-label="Rename"
											title="Rename"
											onclick={() => openEditForm(item)}
										>
											<Pencil class="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											class="btn btn-ghost btn-xs btn-square text-error"
											aria-label="Delete"
											title="Delete"
											onclick={() => openDeleteModal(item)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="border-line border-t px-3 py-2">
				<button
					type="button"
					class="btn btn-ghost btn-xs w-full justify-start"
					onclick={() => openNewForm()}
				>
					<Plus class="h-3.5 w-3.5" />
					Save current search as view
				</button>
			</div>
		{:else}
			<div class="border-line flex items-center gap-2 border-b px-3 pt-3 pb-2">
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					aria-label="Back to list"
					onclick={backToList}
				>
					<ArrowLeft class="h-3.5 w-3.5" />
				</button>
				<p class="eyebrow truncate">
					{editing ? `Edit "${editing.name}"` : 'New view'}
				</p>
			</div>

			<div class="flex flex-col gap-3 p-3">
				<div class="flex flex-col gap-1">
					<p class="eyebrow">Name</p>
					<input
						type="text"
						class="input input-sm"
						placeholder="My view"
						bind:value={formName}
						onkeydown={(e) => {
							if (e.key === 'Enter') submitForm();
						}}
					/>
					{#if formNameError}
						<p class="text-error text-xs">{formNameError}</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<p class="eyebrow">Description (optional)</p>
					<input
						type="text"
						class="input input-sm"
						placeholder="What does this view show?"
						bind:value={formDescription}
					/>
				</div>

				{#if !editing}
					<p class="text-base-content/60 text-xs">
						Saves the current query, filters, sort direction, and columns.
					</p>
				{/if}

				{#if formError}
					<p class="text-error text-xs">{formError}</p>
				{/if}
			</div>

			<div class="border-line flex justify-end gap-2 border-t px-3 py-2">
				<button type="button" class="btn btn-ghost btn-sm" onclick={backToList}>Cancel</button>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					disabled={!formCanSave}
					onclick={submitForm}
				>
					{editing ? 'Save' : 'Save view'}
				</button>
			</div>
		{/if}
	</div>
</details>

<ConfirmModal
	bind:open={deleteModalOpen}
	title="Delete view"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	bind:loading={deleting}
	onConfirm={confirmDelete}
>
	{#snippet message()}
		Delete <span class="font-semibold">{toDelete?.name}</span>? This can't be undone.
	{/snippet}
</ConfirmModal>

<ConfirmModal
	bind:open={overwriteModalOpen}
	title="Update view"
	confirmLabel="Update"
	confirmingLabel="Updating…"
	bind:loading={overwriting}
	onConfirm={confirmOverwrite}
>
	{#snippet message()}
		Overwrite <span class="font-semibold">{toOverwrite?.name}</span> with the current search? Its saved
		query, filters, sort direction, and columns will be replaced.
	{/snippet}
</ConfirmModal>
