<script lang="ts">
	import { isTraceId } from 'api/schemas';
	import { CircleAlert, CircleCheck, ListTree, RefreshCw, X } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { ExploreFilters } from '$lib/api/traces';
	import ServicePicker from '$lib/components/monitoring/ServicePicker.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { readLastIndex } from '$lib/utils/last-index';
	import { paramWholeNumber } from '$lib/utils/query-params';
	import { traceDetailHref, traceHasSpans } from '$lib/utils/trace-params';

	type FilterName = 'service' | 'operation' | 'status' | 'root' | 'q';

	type Props = {
		filters: ExploreFilters;
		timeRange: TimeRange;
		services: string[];
		queryError: string | null;
		refreshing: boolean;
		onFilter: (name: FilterName, value: string | null) => void;
		onDuration: (minMs: number | null, maxMs: number | null) => void;
		onRange: (range: TimeRange) => void;
		onRefresh: () => void;
	};

	let {
		filters,
		timeRange,
		services,
		queryError,
		refreshing,
		onFilter,
		onDuration,
		onRange,
		onRefresh
	}: Props = $props();

	const uid = $props.id();
	const queryErrorId = `${uid}-query-error`;

	const DURATION_PRESETS = [
		{ id: 'any', label: 'Any duration', minMs: null, maxMs: null },
		{ id: 'lt10ms', label: '< 10 ms', minMs: null, maxMs: 10 },
		{ id: '10-100ms', label: '10–100 ms', minMs: 10, maxMs: 100 },
		{ id: '100ms-1s', label: '100 ms – 1 s', minMs: 100, maxMs: 1_000 },
		{ id: '1-10s', label: '1–10 s', minMs: 1_000, maxMs: 10_000 },
		{ id: 'gt10s', label: '> 10 s', minMs: 10_000, maxMs: null }
	] as const;

	const presetId = $derived(
		DURATION_PRESETS.find((p) => p.minMs === filters.minMs && p.maxMs === filters.maxMs)?.id ??
			'custom'
	);
	let customOpen = $state(false);
	const showCustom = $derived(customOpen || presetId === 'custom');
	const rootErrors = $derived(filters.root && filters.status === 'error');

	// Follows the applied query until the user edits it; a navigation resets it to the URL value.
	let draft = $derived(filters.q);

	function pickDuration(id: string) {
		if (id === 'custom') {
			customOpen = true;
			return;
		}
		customOpen = false;
		const preset = DURATION_PRESETS.find((p) => p.id === id);
		if (preset !== undefined) onDuration(preset.minMs, preset.maxMs);
	}

	function applyCustom(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const data = new FormData(form);
		const minMs = paramWholeNumber(data.get('minMs') as string | null);
		const maxMs = paramWholeNumber(data.get('maxMs') as string | null);
		if (minMs !== null && maxMs !== null && minMs >= maxMs) {
			const maxInput = form.elements.namedItem('maxMs') as HTMLInputElement;
			maxInput.setCustomValidity('Must be greater than Min ms');
			maxInput.reportValidity();
			return;
		}
		onDuration(minMs, maxMs);
	}

	async function applyQuery(event: SubmitEvent) {
		event.preventDefault();
		const query = draft.trim();
		const raw = query.toLowerCase();
		if (isTraceId(raw)) {
			const href = traceDetailHref(raw, { index: readLastIndex(), returnTo: page.url });
			if (await traceHasSpans(href)) {
				void goto(href);
				return;
			}
		}
		onFilter('q', query || null);
	}

	function toggleStatus(status: 'error' | 'ok') {
		onFilter('status', filters.status === status ? null : status);
	}
</script>

<div class="border-line bg-base-100 flex h-12 shrink-0 items-center gap-2 border-b px-3">
	<ServicePicker
		{services}
		value={filters.service}
		onChange={(value) => onFilter('service', value || null)}
		showLabel={false}
	/>
	<form class="min-w-0 flex-1" onsubmit={applyQuery}>
		<SearchInput
			class={['w-full', queryError !== null && 'input-error']}
			inputClass="font-mono text-xs placeholder:font-sans"
			bind:value={draft}
			placeholder="span_attributes.http.response.status_code:503"
			label="Search spans"
			title="Search spans with a Quickwit query. A 32-character hex ID that matches a trace opens it instead — wrap it in quotes to search for it as text."
			aria-invalid={queryError !== null}
			aria-describedby={queryError === null ? undefined : queryErrorId}
		/>
	</form>
	<select
		class="select select-sm text-ui w-auto shrink-0"
		aria-label="Duration"
		value={showCustom ? 'custom' : presetId}
		onchange={(event) => pickDuration(event.currentTarget.value)}
	>
		{#each DURATION_PRESETS as preset (preset.id)}
			<option value={preset.id}>{preset.label}</option>
		{/each}
		<option value="custom">Custom…</option>
	</select>
	<div class="join shrink-0" role="group" aria-label="Span status">
		<button
			type="button"
			class={['btn btn-sm join-item', filters.status === 'error' && 'btn-error btn-soft']}
			aria-pressed={filters.status === 'error'}
			onclick={() => toggleStatus('error')}
		>
			<CircleAlert class="size-3.5" aria-hidden="true" />Error
		</button>
		<button
			type="button"
			class={['btn btn-sm join-item', filters.status === 'ok' && 'btn-success btn-soft']}
			aria-pressed={filters.status === 'ok'}
			onclick={() => toggleStatus('ok')}
		>
			<CircleCheck class="size-3.5" aria-hidden="true" />OK
		</button>
	</div>
	<button
		type="button"
		class={['btn btn-sm shrink-0', filters.root && 'btn-neutral btn-soft']}
		aria-pressed={filters.root}
		title="Only each trace's root span"
		onclick={() => onFilter('root', filters.root ? null : 'true')}
	>
		<ListTree class="size-3.5" aria-hidden="true" />Root only
	</button>
	<TimeRangePicker value={timeRange} onChange={onRange} />
	<button
		type="button"
		class="btn btn-sm btn-ghost ml-auto shrink-0"
		disabled={refreshing}
		onclick={onRefresh}
	>
		{#if refreshing}
			<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
		{:else}
			<RefreshCw class="size-3.5" aria-hidden="true" />
		{/if}
		Refresh
	</button>
</div>

{#if filters.operation !== null || showCustom || rootErrors || queryError !== null}
	<div
		class="border-line bg-base-100 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 text-xs"
	>
		{#if filters.operation !== null}
			<span class="badge badge-sm badge-neutral badge-soft gap-1 font-mono">
				<span class="max-w-[24rem] truncate" title={filters.operation}>
					operation "{filters.operation}"
				</span>
				<button
					type="button"
					class="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
					aria-label={`Remove operation filter ${filters.operation}`}
					title="Remove filter"
					onclick={() => onFilter('operation', null)}
				>
					<X class="size-3" aria-hidden="true" />
				</button>
			</span>
		{/if}
		{#if showCustom}
			<form
				class="flex flex-wrap items-center gap-2"
				onsubmit={applyCustom}
				oninput={(event) =>
					(event.currentTarget.elements.namedItem('maxMs') as HTMLInputElement).setCustomValidity(
						''
					)}
			>
				<label class="input input-xs w-36">
					<span class="label">Min ms</span>
					<input name="minMs" type="number" min="0" step="1" value={filters.minMs ?? ''} />
				</label>
				<label class="input input-xs w-36">
					<span class="label">Below ms</span>
					<input name="maxMs" type="number" min="1" step="1" value={filters.maxMs ?? ''} />
				</label>
				<button type="submit" class="btn btn-xs">Apply</button>
			</form>
		{/if}
		{#if rootErrors}
			<p class="text-muted">
				Traces whose root span failed. Errors deeper in a trace aren't shown.
			</p>
		{/if}
		{#if queryError !== null}
			<p id={queryErrorId} class="text-error" role="alert">{queryError}</p>
		{/if}
	</div>
{/if}
