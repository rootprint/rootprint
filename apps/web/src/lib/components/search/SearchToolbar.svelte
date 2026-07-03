<script lang="ts">
	import { tick } from 'svelte';
	import { Play, Share2 } from 'lucide-svelte';
	import TimeRangePicker from './TimeRangePicker.svelte';
	import ViewsDropdown from './ViewsDropdown.svelte';
	import QuerySuggestDropdown from './QuerySuggestDropdown.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import type { LogFieldValueBucket, QuerySuggestion } from '$lib/types';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { tokenAtCaret, type CaretToken } from '$lib/utils/query-token';
	import { serializeTimeRange } from '$lib/utils/fields';
	import { fetchFieldValuesBulk } from '$lib/api/field-values';
	import { escapeFilterValue } from 'api/query';

	let { store }: { store: SearchStore } = $props();

	let queryInput = $state(store.query);
	let focused = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	let token = $state<CaretToken | null>(null);
	let highlight = $state(-1);
	let dismissed = $state(false);

	const valueCache = new Map<string, LogFieldValueBucket[]>();
	let valueState = $state<{ key: string; buckets: LogFieldValueBucket[] } | null>(null);
	let valueAbort: AbortController | null = null;

	$effect(() => {
		if (!focused) queryInput = store.query;
	});

	function refreshToken() {
		const el = inputEl;
		const next =
			el !== null && focused
				? tokenAtCaret(queryInput, el.selectionStart ?? queryInput.length)
				: null;
		if (JSON.stringify(next) !== JSON.stringify(token)) {
			token = next;
			highlight = -1;
			dismissed = false;
		}
	}

	const valueFetchKey = $derived.by(() => {
		const t = token;
		const id = store.selectedIndex;
		if (t === null || t.kind !== 'value' || id === null) return null;
		return `${id}|${t.field}|${store.composedQuery}|${serializeTimeRange(store.timeRange)}`;
	});

	$effect(() => {
		const key = valueFetchKey;
		const t = token;
		const id = store.selectedIndex;
		if (key === null || t === null || t.kind !== 'value' || id === null) return;
		const cached = valueCache.get(key);
		if (cached !== undefined) {
			valueState = { key, buckets: cached };
			return;
		}
		const timer = setTimeout(() => {
			valueAbort?.abort();
			const ctl = new AbortController();
			valueAbort = ctl;
			fetchFieldValuesBulk({
				indexId: id,
				fields: [t.field],
				// composedQuery + no filters: unlike sidepanel facets, the field's own
				// chip must apply, so only values that actually yield logs get suggested
				query: store.composedQuery,
				filters: [],
				timeRange: store.timeRange,
				// FIXME: values outside the endpoint's top-1000 not suggested for now
				limit: 1000,
				signal: ctl.signal
			})
				.then((res) => {
					if (ctl.signal.aborted) return;
					const buckets = res[t.field] ?? [];
					valueCache.set(key, buckets);
					valueState = { key, buckets };
				})
				.catch(() => {
					if (!ctl.signal.aborted) valueState = { key, buckets: [] };
				});
		}, 200);
		return () => clearTimeout(timer);
	});

	const suggestions = $derived.by<QuerySuggestion[]>(() => {
		const t = token;
		if (t === null || dismissed) return [];
		const q = t.prefix.toLowerCase();
		if (t.kind === 'field') {
			return store.fields
				.filter((f) => f.name.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q))
				.slice(0, 10)
				.map((f) => ({
					label: f.displayName,
					detail: f.name === f.displayName ? f.type : f.name,
					insert: f.name
				}));
		}
		if (valueState === null || valueState.key !== valueFetchKey) return [];
		return valueState.buckets
			.filter((b) => b.value.toLowerCase().includes(q))
			.slice(0, 10)
			.map((b) => ({ label: b.value, detail: b.count.toLocaleString(), insert: b.value }));
	});

	async function accept(i: number) {
		const t = token;
		const s = suggestions[i];
		if (t === null || s === undefined) return;
		const inserted = t.kind === 'field' ? `${s.insert}:` : `${escapeFilterValue(s.insert)} `;
		queryInput = queryInput.slice(0, t.start) + inserted + queryInput.slice(t.end);
		const caret = t.start + inserted.length;
		await tick();
		inputEl?.setSelectionRange(caret, caret);
		refreshToken();
	}

	function handleKeydown(e: KeyboardEvent) {
		const open = suggestions.length > 0;
		if (e.key === 'ArrowDown' && open) {
			e.preventDefault();
			highlight = Math.min(highlight + 1, suggestions.length - 1);
		} else if (e.key === 'ArrowUp' && open) {
			e.preventDefault();
			highlight = Math.max(highlight - 1, -1);
		} else if (
			(e.key === 'Enter' || e.key === 'Tab') &&
			open &&
			highlight >= 0 &&
			highlight < suggestions.length
		) {
			e.preventDefault();
			void accept(highlight);
		} else if (e.key === 'Enter') {
			commitQuery();
		} else if (e.key === 'Escape' && open) {
			e.stopPropagation();
			dismissed = true;
		}
	}

	function commitQuery() {
		dismissed = true;
		if (queryInput !== store.query) {
			store.runQuery(queryInput);
		}
	}

	function shareLink() {
		void copyWithToast(window.location.href, 'Link copied', 'Failed to copy link');
	}
</script>

<div class="border-line bg-base-100 flex h-12 items-center gap-2 border-b px-3">
	<ViewsDropdown {store} />

	<select
		class="select select-sm w-auto min-w-0 font-mono text-xs"
		value={store.selectedIndex}
		onchange={(e) => store.handleIndexChange((e.currentTarget as HTMLSelectElement).value)}
	>
		{#each store.indexes as idx (idx.id)}
			<option value={idx.id}>{idx.name}</option>
		{/each}
	</select>

	<div class="relative min-w-0 flex-1">
		<input
			type="text"
			class="input input-sm w-full font-mono"
			placeholder="Search logs…"
			bind:this={inputEl}
			bind:value={queryInput}
			onfocus={() => {
				focused = true;
				refreshToken();
			}}
			onblur={() => {
				focused = false;
				token = null;
				highlight = -1;
				commitQuery();
			}}
			oninput={refreshToken}
			onclick={refreshToken}
			onkeyup={refreshToken}
			onkeydown={handleKeydown}
		/>
		{#if suggestions.length > 0}
			<QuerySuggestDropdown
				items={suggestions}
				kind={token?.kind ?? 'field'}
				{highlight}
				onPick={(i) => void accept(i)}
			/>
		{/if}
	</div>

	<TimeRangePicker
		value={store.timeRange}
		onChange={(next) => store.navigateQuery({ timeRange: next }, { push: true })}
	/>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class="btn btn-sm btn-ghost"
			aria-label="Share"
			title="Share"
			onclick={shareLink}
		>
			<Share2 class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			class="btn btn-sm btn-primary"
			aria-label="Run query"
			title="Run query"
			onclick={() => store.runQuery(queryInput)}
		>
			<Play class="h-3.5 w-3.5" />
			Run
		</button>
	</div>
</div>
