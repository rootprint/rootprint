<script lang="ts">
	import { tick } from 'svelte';
	import { Play, Share2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isTraceId } from 'api/schemas';
	import { traceDetailHref } from '$lib/utils/trace-params';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import ViewsDropdown from './ViewsDropdown.svelte';
	import QuerySuggestDropdown from './QuerySuggestDropdown.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import type { LogFieldValueBucket, QuerySuggestion } from '$lib/types';
	import { tokenAtCaret, type CaretToken } from '$lib/utils/query-token';
	import { serializeTimeRange } from '$lib/utils/fields';
	import { fetchFieldValuesBulk } from '$lib/api/field-values';
	import { escapeFilterValue } from 'api/query';

	const SUGGEST_LIMIT = 50;

	let { store }: { store: SearchStore } = $props();

	let queryInput = $state(store.query);
	let focused = $state(false);
	let inputEl: HTMLInputElement | null = $state(null);

	let token = $state<CaretToken | null>(null);
	let highlight = $state(-1);
	let dismissed = $state(false);

	const unrun = $derived(queryInput !== store.query);

	const valueCache = new Map<string, LogFieldValueBucket[]>();
	let valueCacheRevision = -1;
	let valueState = $state<{ key: string; buckets: LogFieldValueBucket[] } | null>(null);
	let valueAbort: AbortController | null = null;

	let lastQuery: string | undefined;
	$effect(() => {
		const q = store.query;
		if (q === lastQuery) return;
		lastQuery = q;
		queryInput = q;
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
		return `${id}|${t.field}|${store.composedQuery}|${serializeTimeRange(store.timeRange)}|${store.refreshRevision}`;
	});

	$effect(() => {
		const revision = store.refreshRevision;
		if (revision !== valueCacheRevision) {
			valueCache.clear();
			valueCacheRevision = revision;
		}
		if (dismissed) return;
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
		return () => {
			clearTimeout(timer);
			valueAbort?.abort();
		};
	});

	function prefixFirst(items: QuerySuggestion[], q: string): QuerySuggestion[] {
		if (q === '') return items;
		const head: QuerySuggestion[] = [];
		const tail: QuerySuggestion[] = [];
		for (const s of items) {
			const hit = s.label.toLowerCase().startsWith(q) || s.insert.toLowerCase().startsWith(q);
			(hit ? head : tail).push(s);
		}
		return [...head, ...tail];
	}

	const matched = $derived.by<QuerySuggestion[]>(() => {
		const t = token;
		if (t === null || dismissed) return [];
		const q = t.prefix.toLowerCase();
		if (t.kind === 'field') {
			const fields = store.fields
				.filter((f) => f.name.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q))
				.map((f) => ({
					label: f.displayName,
					detail: f.name === f.displayName ? f.type : f.name,
					insert: f.name
				}));
			return prefixFirst(fields, q);
		}
		if (valueState === null || valueState.key !== valueFetchKey) return [];
		const values = valueState.buckets
			.filter((b) => b.value.toLowerCase().includes(q))
			.map((b) => ({ label: b.value, detail: b.count.toLocaleString(), insert: b.value }));
		return prefixFirst(values, q);
	});

	const suggestions = $derived(matched.slice(0, SUGGEST_LIMIT));
	const hiddenCount = $derived(matched.length - suggestions.length);
	const suggestOpen = $derived(token !== null && !dismissed);
	const valuesPending = $derived(
		token?.kind === 'value' && (valueState === null || valueState.key !== valueFetchKey)
	);

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
			runQuery();
		} else if (e.key === 'Escape' && suggestOpen) {
			e.stopPropagation();
			dismissed = true;
		}
	}

	/**
	 * A pasted trace id opens the trace instead of searching; one with no spans comes back as a text
	 * search. Only on Enter or Run — blur no longer commits, and navigating away from a click would
	 * surprise. `isTraceId` rejects the all-zeros id, so OTLP's null trace id still falls through.
	 */
	function runQuery() {
		const raw = queryInput.trim().toLowerCase();
		dismissed = true;
		if (isTraceId(raw)) {
			queryInput = '';
			void goto(
				traceDetailHref(raw, { index: store.selectedIndex, returnTo: page.url, pasted: true })
			);
			return;
		}
		store.runQuery(queryInput);
	}
</script>

<div class="border-line bg-base-100 flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<ViewsDropdown {store} />

	<select
		class="select select-sm text-ui w-auto max-w-36 min-w-0"
		aria-label="Index"
		value={store.selectedIndex}
		onchange={(e) => store.handleIndexChange((e.currentTarget as HTMLSelectElement).value)}
	>
		{#each store.indexes as idx (idx.id)}
			<option value={idx.id}>{idx.name}</option>
		{/each}
	</select>

	<div class="relative min-w-0 flex-1">
		<SearchInput
			class="w-full"
			inputClass="font-mono text-xs placeholder:font-sans"
			type="text"
			label="Search logs"
			placeholder="Search logs… (or paste a trace ID)"
			title={'Search logs with a Quickwit query. A 32-character hex ID that matches a trace opens it instead — wrap it in quotes to search for it as text.'}
			bind:ref={inputEl}
			bind:value={queryInput}
			onfocus={() => {
				focused = true;
				refreshToken();
			}}
			onblur={() => {
				focused = false;
				token = null;
				highlight = -1;
			}}
			oninput={refreshToken}
			onclick={refreshToken}
			onkeyup={refreshToken}
			onkeydown={handleKeydown}
		/>
		{#if suggestOpen}
			<QuerySuggestDropdown
				items={suggestions}
				kind={token?.kind ?? 'field'}
				hidden={hiddenCount}
				pending={valuesPending}
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
		<CopyButton
			text={page.url.href}
			icon={Share2}
			class="btn btn-sm btn-ghost [&_svg]:size-3.5"
			aria-label="Copy link"
			title="Copy link"
		/>
		<button
			type="button"
			class="btn btn-sm {unrun ? 'btn-primary' : 'btn-ghost'}"
			aria-label="Run query"
			title="Run query"
			onmousedown={(e) => {
				e.preventDefault();
			}}
			onclick={runQuery}
		>
			<Play class="size-3.5" aria-hidden="true" />
			Run
		</button>
	</div>
</div>
