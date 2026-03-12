<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getHistory, deleteHistoryEntry, clearHistory } from '$lib/api/history.remote';
	import { TIME_PRESETS, type TimeRange } from '$lib/types';
	import type { ParsedQuery } from '$lib/utils/query-params';

	let {
		indexName,
		onrestore
	}: {
		indexName: string | null;
		onrestore: (params: Partial<ParsedQuery>) => void;
	} = $props();

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
		if (indexName) load();
	});

	function formatTimeRange(tr: TimeRange): string {
		if (tr.type === 'relative') {
			const preset = TIME_PRESETS.find((p) => p.code === tr.preset);
			return preset ? preset.label : tr.preset;
		}
		const start = new Date(tr.start * 1000);
		const end = new Date(tr.end * 1000);
		const fmt = (d: Date) =>
			d.toLocaleString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		return `${fmt(start)} – ${fmt(end)}`;
	}

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

	function restore(entry: HistoryEntry) {
		const params: Partial<ParsedQuery> = {
			query: entry.query,
			filters: entry.filters,
			timeRange: entry.timeRange
		};
		onrestore(params);
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
</script>

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
			<div
				class="group flex w-full cursor-pointer flex-col gap-0.5 border-b border-base-300/50 px-3 py-2 text-left hover:bg-base-200"
				role="button"
				tabindex="0"
				onclick={() => restore(entry)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						restore(entry);
					}
				}}
			>
				<div class="flex items-center gap-1">
					<span class="flex-1 truncate text-xs font-medium">
						{entry.query || '*'}
					</span>
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
					<span class="truncate">{formatTimeRange(entry.timeRange)}</span>
					{#if filterCount(entry.filters) > 0}
						<span class="badge badge-xs"
							>{filterCount(entry.filters)} filter{filterCount(entry.filters) > 1 ? 's' : ''}</span
						>
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
