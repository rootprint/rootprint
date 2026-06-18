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
	import * as v from 'valibot';
	import { ApiError, issuesToFieldErrors } from '$lib/api/errors';
	import { listViews, createView, updateView, deleteView } from '$lib/api/views';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { RequestGuard } from '$lib/stores/request-guard';
	import { createViewSchema, patchViewSchema } from 'api/schemas';
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
	let fieldErrors = $state<Record<string, string>>({});
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

	const refreshGuard = new RequestGuard();

	async function refresh() {
		const indexId = store.selectedIndex;
		if (indexId === null) {
			items = [];
			error = 'No index selected';
			return;
		}
		const token = refreshGuard.next();
		loading = true;
		error = null;
		try {
			const next = await listViews(indexId);
			if (!refreshGuard.isCurrent(token)) return;
			items = next;
		} catch (e) {
			if (!refreshGuard.isCurrent(token)) return;
			error = e instanceof Error ? e.message : 'Failed to load views';
			items = [];
		} finally {
			if (refreshGuard.isCurrent(token)) loading = false;
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
		fieldErrors = {};
		panel = 'form';
	}

	function openEditForm(item: SavedView) {
		editing = item;
		formName = item.name;
		formDescription = item.description ?? '';
		formError = null;
		fieldErrors = {};
		panel = 'form';
	}

	function backToList() {
		panel = 'list';
		editing = null;
		formError = null;
		fieldErrors = {};
	}

	const formCanSave = $derived.by(() => {
		if (formSubmitting) return false;
		const name = formName.trim();
		if (name.length === 0) return false;
		if (!editing) return true;
		const nameChanged = name !== editing.name;
		const descChanged = formDescription !== (editing.description ?? '');
		return nameChanged || descChanged;
	});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!formCanSave) return;
		formError = null;
		fieldErrors = {};
		const indexId = store.selectedIndex;
		if (indexId === null) {
			formError = 'No index selected';
			return;
		}

		const name = formName.trim();
		let save: () => Promise<void>;
		if (editing) {
			const editingView = editing;
			const patch: { name?: string; description?: string | null } = {};
			if (name !== editingView.name) patch.name = name;
			if (formDescription !== (editingView.description ?? '')) {
				patch.description = formDescription === '' ? null : formDescription;
			}
			const parsed = v.safeParse(patchViewSchema, patch);
			if (!parsed.success) {
				fieldErrors = issuesToFieldErrors(parsed.issues);
				return;
			}
			save = async () => {
				const row = await updateView(indexId, editingView.id, patch);
				items = items.map((it) => (it.id === row.id ? row : it));
			};
		} else {
			const input = {
				name,
				description: formDescription === '' ? undefined : formDescription,
				...currentSnapshot()
			};
			const parsed = v.safeParse(createViewSchema, input);
			if (!parsed.success) {
				fieldErrors = issuesToFieldErrors(parsed.issues);
				return;
			}
			save = async () => {
				const row = await createView(indexId, input);
				items = [row, ...items];
			};
		}

		formSubmitting = true;
		try {
			await save();
			backToList();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to save view';
			const code = err instanceof ApiError ? err.code : undefined;
			if (code === 'VIEW_NAME_TAKEN') {
				fieldErrors = { name: message };
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

			<form id="view-form" class="flex flex-col gap-3 p-3" {onsubmit}>
				<div class="flex flex-col gap-1">
					<p class="eyebrow">Name</p>
					<input
						type="text"
						class="input input-sm"
						class:input-error={fieldErrors.name}
						placeholder="My view"
						bind:value={formName}
						aria-invalid={fieldErrors.name ? 'true' : undefined}
						aria-describedby={fieldErrors.name ? 'view-form-name-msg' : undefined}
					/>
					{#if fieldErrors.name}
						<p id="view-form-name-msg" class="text-error text-xs">{fieldErrors.name}</p>
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
			</form>

			<div class="border-line flex justify-end gap-2 border-t px-3 py-2">
				<button type="button" class="btn btn-ghost btn-sm" onclick={backToList}>Cancel</button>
				<button
					type="submit"
					form="view-form"
					class="btn btn-primary btn-sm"
					disabled={!formCanSave}
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
