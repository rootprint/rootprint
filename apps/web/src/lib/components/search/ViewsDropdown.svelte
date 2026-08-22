<script lang="ts">
	import { ArrowLeft, ChevronDown, Layers, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-svelte';
	import * as v from 'valibot';
	import { ApiError, issuesToFieldErrors } from '$lib/api/errors';
	import { listViews, createView, updateView, deleteView } from '$lib/api/views';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { RequestGuard } from '$lib/stores/request-guard';
	import { formatTimeRangeLabel } from '$lib/utils/time-range';
	import { createViewSchema, patchViewSchema } from 'api/schemas';
	import type { SavedView } from 'api/types';

	let { store }: { store: SearchStore } = $props();

	let items = $state<SavedView[]>([]);
	let appliedId = $state<number | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const dd = $props.id();
	let panelEl = $state<HTMLDivElement | null>(null);
	let filterText = $state('');

	let toDelete = $state<SavedView | null>(null);
	let deleteModalOpen = $state(false);

	let toOverwrite = $state<SavedView | null>(null);
	let overwriteModalOpen = $state(false);

	type Panel = 'list' | 'form';

	let panel = $state<Panel>('list');
	let editing = $state<SavedView | null>(null);
	let formName = $state('');
	let saveTime = $state(true);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	function currentSnapshot(opts: { withTime: boolean; withColumns: boolean }) {
		return {
			query: store.query,
			filters: store.filters,
			sortDirection: store.sortDirection,
			// Empty means display preferences haven't resolved yet, not "no columns".
			columns: opts.withColumns && store.activeFields.length > 0 ? [...store.activeFields] : null,
			timeRange: opts.withTime ? store.timeRange : null
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
		appliedId = item.id;
		// A view saved without a time range leaves the current one alone.
		const timeRange = item.timeRange ?? store.timeRange;
		store.navigateQuery(
			{ query: item.query, filters: item.filters, sortDirection: item.sortDirection, timeRange },
			{ push: true }
		);
		if (item.columns !== null) store.setActiveFields([...item.columns]);
		close();
	}

	function openNewForm(prefillName = '') {
		editing = null;
		formName = prefillName;
		saveTime = true;
		formError = null;
		fieldErrors = {};
		panel = 'form';
	}

	function openEditForm(item: SavedView) {
		editing = item;
		formName = item.name;
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
		return !editing || name !== editing.name;
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
			const patch = { name };
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
			const input = { name, ...currentSnapshot({ withTime: saveTime, withColumns: true }) };
			const parsed = v.safeParse(createViewSchema, input);
			if (!parsed.success) {
				fieldErrors = issuesToFieldErrors(parsed.issues);
				return;
			}
			save = async () => {
				const row = await createView(indexId, input);
				items = [row, ...items];
				appliedId = row.id;
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

	// Failures must toast: opening a modal dismisses this popover, so `error` — which only
	// renders inside the panel — would never be seen.
	async function confirmOverwrite() {
		const item = toOverwrite;
		if (!item) return;
		const indexId = store.selectedIndex;
		if (indexId === null) throw new Error('No index selected');
		const row = await updateView(
			indexId,
			item.id,
			currentSnapshot({ withTime: item.timeRange !== null, withColumns: item.columns !== null })
		);
		items = items.map((it) => (it.id === row.id ? row : it));
		appliedId = row.id;
		toOverwrite = null;
	}

	function openDeleteModal(item: SavedView) {
		toDelete = item;
		deleteModalOpen = true;
	}

	async function confirmDelete() {
		const item = toDelete;
		if (!item) return;
		const indexId = store.selectedIndex;
		if (indexId === null) throw new Error('No index selected');
		await deleteView(indexId, item.id);
		items = items.filter((it) => it.id !== item.id);
		if (appliedId === item.id) appliedId = null;
		toDelete = null;
	}

	function close() {
		panelEl?.togglePopover(false);
	}

	function onToggle(e: Event) {
		if ((e as ToggleEvent).newState === 'open') {
			refresh();
		} else {
			filterText = '';
			panel = 'list';
			editing = null;
		}
	}

	const filtered = $derived.by(() => {
		const q = filterText.trim().toLowerCase();
		if (!q) return items;
		return items.filter((item) => item.name.toLowerCase().includes(q));
	});

	let lastIndex: string | null | undefined;
	$effect(() => {
		const current = store.selectedIndex;
		if (lastIndex !== undefined && current !== lastIndex) {
			appliedId = null;
			close();
		}
		lastIndex = current;
	});
</script>

<button
	type="button"
	title="Views"
	popovertarget={dd}
	style="anchor-name:--{dd}"
	class="btn btn-sm btn-ghost"
>
	<Layers class="h-3.5 w-3.5" />
	Views
	<ChevronDown class="h-3 w-3 opacity-60" />
</button>

<div
	bind:this={panelEl}
	popover
	id={dd}
	style="position-anchor:--{dd}"
	ontoggle={onToggle}
	class="dropdown border-line bg-base-100 mt-1 flex w-80 flex-col rounded-lg border shadow-lg"
>
	{#if panel === 'list'}
		<div class="border-line flex items-center gap-2 border-b p-2">
			<SearchInput bind:value={filterText} placeholder="Search views…" label="Search views" />
			<button
				type="button"
				class="btn btn-ghost btn-sm btn-square shrink-0"
				aria-label="Save current search as view"
				title="Save current search as view"
				onclick={() => openNewForm()}
			>
				<Plus class="h-4 w-4" />
			</button>
		</div>

		<div class="max-h-[28rem] min-h-[12rem] flex-1 overflow-y-auto">
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
				<div class="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
					<p class="text-base-content/60 text-xs">No views yet</p>
					<button type="button" class="btn btn-ghost btn-xs" onclick={() => openNewForm()}>
						<Plus class="h-3.5 w-3.5" />
						Save current search
					</button>
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
				<ul class="p-1">
					{#each filtered as item (item.id)}
						{@const applied = item.id === appliedId}
						<li>
							<div
								class="group hover:bg-base-200/60 flex items-center rounded"
								class:bg-base-200={applied}
							>
								<button
									type="button"
									aria-current={applied ? 'true' : undefined}
									class="nav-rail flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
									onclick={() => applyView(item)}
									title={item.query || 'Empty query'}
								>
									<span class="nav-rail-bar"></span>
									<span class="truncate text-xs" class:font-medium={applied}>{item.name}</span>
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
	{:else}
		<div class="border-line flex items-center gap-2 border-b p-2">
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square"
				aria-label="Back to list"
				onclick={backToList}
			>
				<ArrowLeft class="h-3.5 w-3.5" />
			</button>
			<p class="eyebrow truncate">
				{editing ? 'Rename view' : 'New view'}
			</p>
		</div>

		<form id="view-form" class="flex flex-col gap-2 p-3" {onsubmit}>
			<input
				type="text"
				class="input input-sm w-full"
				class:input-error={fieldErrors.name}
				placeholder="View name"
				aria-label="View name"
				bind:value={formName}
				aria-invalid={fieldErrors.name ? 'true' : undefined}
				aria-describedby={fieldErrors.name ? 'view-form-name-msg' : undefined}
			/>
			{#if fieldErrors.name}
				<p id="view-form-name-msg" class="text-error text-xs">{fieldErrors.name}</p>
			{/if}

			{#if !editing}
				<p class="text-base-content/60 text-xs">
					Saves the current query, filters, sort direction, and columns.
				</p>
				<label class="flex items-center gap-1.5 text-xs">
					<input type="checkbox" class="checkbox checkbox-xs" bind:checked={saveTime} />
					Save time range ({formatTimeRangeLabel(store.timeRange)})
				</label>
			{/if}

			{#if formError}
				<p class="text-error text-xs">{formError}</p>
			{/if}
		</form>

		<div class="border-line flex justify-end gap-2 border-t p-2">
			<button type="button" class="btn btn-ghost btn-sm" onclick={backToList}>Cancel</button>
			<button type="submit" form="view-form" class="btn btn-primary btn-sm" disabled={!formCanSave}>
				Save
			</button>
		</div>
	{/if}
</div>

<ConfirmModal
	bind:open={deleteModalOpen}
	title="Delete view"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	errorFallback="Failed to delete view"
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
	errorFallback="Failed to update view"
	onConfirm={confirmOverwrite}
>
	{#snippet message()}
		Overwrite <span class="font-semibold">{toOverwrite?.name}</span> with the current search? Its saved
		settings will be replaced.
	{/snippet}
</ConfirmModal>
