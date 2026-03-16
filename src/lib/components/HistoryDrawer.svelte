<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getHistory, deleteHistoryEntry, clearHistory } from '$lib/api/history.remote';
	import { getSavedQueries, deleteSavedQuery } from '$lib/api/saved-queries.remote';
	import { type TimeRange } from '$lib/types';
	import { formatTimeRangeLabel } from '$lib/utils/time';
	import type { ParsedQuery } from '$lib/utils/query-params';
	import SaveQueryModal from './SaveQueryModal.svelte';

	let {
		open,
		indexName,
		historyVersion = 0,
		onrestore,
		onclose
	}: {
		open: boolean;
		indexName: string | null;
		historyVersion?: number;
		onrestore: (params: Partial<ParsedQuery>) => void;
		onclose: () => void;
	} = $props();

	let activeTab = $state<'history' | 'saved' | 'shared'>('history');

	const tabs = [
		{ id: 'history' as const, label: 'History', icon: 'lucide:clock', enabled: true },
		{ id: 'saved' as const, label: 'Saved', icon: 'lucide:bookmark', enabled: true },
		{ id: 'shared' as const, label: 'Shared', icon: 'lucide:users', enabled: false }
	];

	type HistoryEntry = {
		id: number;
		indexName: string;
		query: string;
		timeRange: TimeRange;
		filters: Record<string, string[]>;
		executedAt: Date;
	};

	let entries = $state<HistoryEntry[]>([]);
	let loading = $state(false);

	type SavedEntry = {
		id: number;
		indexName: string;
		name: string;
		description: string | null;
		query: string;
		createdAt: Date;
	};

	let savedEntries = $state<SavedEntry[]>([]);
	let savedLoading = $state(false);
	let savedVersion = $state(0);
	let savingEntry = $state<HistoryEntry | null>(null);
	let saveModalOpen = $state(false);

	async function load() {
		if (!indexName) return;
		loading = true;
		try {
			entries = (await getHistory({ indexName })) as HistoryEntry[];
		} catch {
			entries = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open && indexName) {
			void historyVersion;
			load();
		}
	});

	function formatRelativeTime(date: Date): string {
		const now = Date.now();
		const diff = now - date.getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function filterCount(filters: Record<string, string[]>): number {
		return Object.values(filters).reduce((sum, v) => sum + v.length, 0);
	}

	function restoreHistory(entry: HistoryEntry) {
		onrestore({
			query: entry.query,
			filters: entry.filters,
			timeRange: entry.timeRange
		});
		onclose();
	}

	function restoreSaved(entry: SavedEntry) {
		onrestore({
			query: entry.query
		});
		onclose();
	}

	async function remove(id: number) {
		await deleteHistoryEntry({ id });
		entries = entries.filter((e) => e.id !== id);
	}

	async function clearAll() {
		if (!indexName) return;
		await clearHistory({ indexName });
		entries = [];
	}

	async function loadSaved() {
		if (!indexName) return;
		savedLoading = true;
		try {
			savedEntries = (await getSavedQueries({ indexName })) as SavedEntry[];
		} catch {
			savedEntries = [];
		} finally {
			savedLoading = false;
		}
	}

	$effect(() => {
		if (open && activeTab === 'saved' && indexName) {
			void savedVersion;
			loadSaved();
		}
	});

	async function removeSaved(id: number) {
		await deleteSavedQuery({ id });
		savedEntries = savedEntries.filter((e) => e.id !== id);
	}

	function bookmark(entry: HistoryEntry) {
		savingEntry = entry;
		saveModalOpen = true;
	}

	$effect(() => {
		if (!saveModalOpen) {
			savingEntry = null;
		}
	});
</script>

{#if open}
	<div
		class="absolute top-0 right-0 z-20 flex h-full w-xl flex-col border-l border-base-300 bg-base-100 shadow-lg"
	>
		<div class="flex items-center justify-between border-b border-base-300 px-3">
			<div role="tablist" class="tabs-border tabs">
				{#each tabs as tab (tab.id)}
					<button
						role="tab"
						class="tab gap-1.5"
						class:tab-active={activeTab === tab.id}
						disabled={!tab.enabled}
						title={tab.enabled ? tab.label : `${tab.label} (coming soon)`}
						onclick={() => {
							if (tab.enabled) activeTab = tab.id;
						}}
					>
						<Icon icon={tab.icon} width="12" height="12" />
						{tab.label}
					</button>
				{/each}
			</div>
			<button class="btn btn-square btn-ghost btn-xs" onclick={onclose} title="Close">
				<Icon icon="lucide:x" width="14" height="14" />
			</button>
		</div>

		<div class="flex-1 overflow-x-hidden overflow-y-auto">
			{#if activeTab === 'history'}
				{#if loading}
					<div class="flex items-center justify-center py-4">
						<span class="loading loading-sm loading-spinner"></span>
					</div>
				{:else if entries.length === 0}
					<div class="px-3 py-3">
						<p class="text-[11px] text-base-content/30">No search history yet</p>
					</div>
				{:else}
					<div class="flex flex-col">
						{#each entries as entry (entry.id)}
							{@const count = filterCount(entry.filters)}
							<div
								class="group flex w-full cursor-pointer flex-col gap-0.5 border-b border-base-300/50 px-3 py-2 text-left hover:bg-base-200"
								role="button"
								tabindex="0"
								onclick={() => restoreHistory(entry)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										restoreHistory(entry);
									}
								}}
							>
								<div class="flex items-center gap-1">
									<span class="flex-1 truncate text-xs font-medium">
										{entry.query || '*'}
									</span>
									<button
										class="btn p-0 opacity-20 btn-ghost btn-xs group-hover:opacity-60"
										onclick={(e) => {
											e.stopPropagation();
											bookmark(entry);
										}}
										title="Save query"
									>
										<Icon
											icon="lucide:bookmark"
											width="12"
											height="12"
											class="hover:text-warning"
										/>
									</button>
									<button
										class="btn p-0 opacity-0 btn-ghost btn-xs group-hover:opacity-100"
										onclick={(e) => {
											e.stopPropagation();
											remove(entry.id);
										}}
										title="Remove from history"
									>
										<Icon icon="lucide:x" width="12" height="12" />
									</button>
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-base-content/40">
									<span class="truncate">{formatTimeRangeLabel(entry.timeRange, 'local')}</span>
									{#if count > 0}
										<span class="badge badge-xs">{count} filter{count > 1 ? 's' : ''}</span>
									{/if}
									<span class="ml-auto shrink-0">{formatRelativeTime(entry.executedAt)}</span>
								</div>
							</div>
						{/each}
						<div class="px-3 py-2">
							<button class="btn w-full btn-ghost btn-xs" onclick={clearAll}> Clear all </button>
						</div>
					</div>
				{/if}
			{/if}
			{#if activeTab === 'saved'}
				{#if savedLoading}
					<div class="flex items-center justify-center py-4">
						<span class="loading loading-sm loading-spinner"></span>
					</div>
				{:else if savedEntries.length === 0}
					<div class="px-3 py-3">
						<p class="text-[11px] text-base-content/30">No saved queries yet</p>
					</div>
				{:else}
					<div class="flex flex-col">
						{#each savedEntries as entry (entry.id)}
							<div
								class="group flex w-full cursor-pointer flex-col gap-0.5 border-b border-base-300/50 px-3 py-2 text-left hover:bg-base-200"
								role="button"
								tabindex="0"
								onclick={() => restoreSaved(entry)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										restoreSaved(entry);
									}
								}}
							>
								<div class="flex items-center gap-1">
									<span class="flex-1 truncate text-xs font-medium">
										{entry.name}
									</span>
									<button
										class="btn p-0 opacity-0 btn-ghost btn-xs group-hover:opacity-100"
										onclick={(e) => {
											e.stopPropagation();
											removeSaved(entry.id);
										}}
										title="Remove saved query"
									>
										<Icon icon="lucide:x" width="12" height="12" />
									</button>
								</div>
								<div class="flex items-center gap-1.5 text-[10px] text-base-content/40">
									<span class="truncate">{entry.query || '*'}</span>
								</div>
								{#if entry.description}
									<div class="truncate text-[10px] text-base-content/30 italic">
										{entry.description}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
		<SaveQueryModal
			bind:open={saveModalOpen}
			entry={savingEntry
				? {
						indexName: savingEntry.indexName,
						query: savingEntry.query
					}
				: null}
			onsaved={() => {
				savedVersion++;
			}}
		/>
	</div>
{/if}
