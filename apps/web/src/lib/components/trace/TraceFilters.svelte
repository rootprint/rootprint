<script lang="ts">
	import { isTraceId } from 'api/schemas';
	import { CircleAlert } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { TraceExplorerStore } from '$lib/stores/trace-explorer.svelte';
	import { traceDetailHref } from '$lib/utils/trace-params';

	let { store }: { store: TraceExplorerStore } = $props();

	const params = $derived(store.params);

	let traceIdInput = $state('');
	const traceIdValid = $derived(isTraceId(traceIdInput.trim().toLowerCase()));

	function jumpToTrace(event: SubmitEvent): void {
		event.preventDefault();
		const id = traceIdInput.trim().toLowerCase();
		if (!isTraceId(id)) return;
		traceIdInput = '';
		void goto(traceDetailHref(id, { index: store.selectedIndex, returnTo: page.url }));
	}

	/** Mirrors `RootFilterEntries` in apps/api/src/schemas/traces.ts; past it the API 400s. */
	const MAX_DURATION_MS = 3_600_000;

	/** Empty clears the bound; anything the API would reject is ignored so it never navigates. */
	function parseMs(raw: string): number | null | undefined {
		const trimmed = raw.trim();
		if (trimmed === '') return null;
		const ms = Number(trimmed);
		if (!Number.isInteger(ms) || ms < 0 || ms > MAX_DURATION_MS) return undefined;
		return ms;
	}

	function onMinDuration(raw: string): void {
		const value = parseMs(raw);
		if (value === undefined) return;
		const max = params.maxMs;
		store.navigate(
			value !== null && max !== null && value > max
				? { minMs: value, maxMs: value }
				: { minMs: value }
		);
	}

	function onMaxDuration(raw: string): void {
		const value = parseMs(raw);
		if (value === undefined) return;
		const min = params.minMs;
		store.navigate(
			value !== null && min !== null && value < min
				? { maxMs: value, minMs: value }
				: { maxMs: value }
		);
	}
</script>

<div
	class="border-line bg-base-100 flex flex-wrap items-center gap-2 border-b px-3 py-2"
	aria-label="Trace filters"
>
	<select
		class="select select-xs w-44"
		value={params.service ?? ''}
		onchange={(e) => store.setService(e.currentTarget.value || null)}
		aria-label="Service"
	>
		<option value="">All services</option>
		<!-- The roster is windowed, so the URL's service can be absent from it — without this the select
		     renders blank and the active filter looks unset. -->
		{#if params.service !== null && !store.services.includes(params.service)}
			<option value={params.service}>{params.service}</option>
		{/if}
		{#each store.services as service (service)}
			<option value={service}>{service}</option>
		{/each}
	</select>

	<select
		class="select select-xs w-52"
		value={params.operation ?? ''}
		onchange={(e) => store.navigate({ operation: e.currentTarget.value || null }, { push: true })}
		disabled={params.service === null || store.operationsLoading}
		aria-label="Operation"
		title={params.service === null ? 'Pick a service first' : undefined}
	>
		<option value="">All operations</option>
		{#if params.operation !== null && !store.operations.includes(params.operation)}
			<option value={params.operation}>{params.operation}</option>
		{/if}
		{#each store.operations as operation (operation)}
			<option value={operation}>{operation}</option>
		{/each}
	</select>

	<div class="flex items-center gap-1">
		<span
			class="text-base-content/50 text-xs"
			title="Millisecond precision, so 0 includes everything"
		>
			Root duration
		</span>
		<input
			type="number"
			min="0"
			max={MAX_DURATION_MS}
			step="1"
			class="input input-xs w-20 tabular-nums"
			placeholder="min"
			value={params.minMs ?? ''}
			onchange={(e) => onMinDuration(e.currentTarget.value)}
			aria-label="Minimum root span duration in milliseconds"
		/>
		<span class="text-base-content/30 text-xs">–</span>
		<input
			type="number"
			min="0"
			max={MAX_DURATION_MS}
			step="1"
			class="input input-xs w-20 tabular-nums"
			placeholder="max"
			value={params.maxMs ?? ''}
			onchange={(e) => onMaxDuration(e.currentTarget.value)}
			aria-label="Maximum root span duration in milliseconds"
		/>
		<span class="text-base-content/50 text-xs">ms</span>
	</div>

	<label class="flex cursor-pointer items-center gap-1.5 text-xs">
		<input
			type="checkbox"
			class="checkbox checkbox-xs"
			checked={params.errorsOnly}
			onchange={(e) => store.navigate({ errorsOnly: e.currentTarget.checked }, { push: true })}
		/>
		Errors only
	</label>

	<div class="flex-1"></div>

	<form class="flex items-center gap-1" onsubmit={jumpToTrace}>
		<input
			type="text"
			class="input input-xs w-64 font-mono"
			placeholder="Go to trace ID"
			bind:value={traceIdInput}
			aria-label="Trace ID"
			aria-invalid={traceIdInput !== '' && !traceIdValid}
		/>
		{#if traceIdInput !== '' && !traceIdValid}
			<span class="text-base-content/50" title="Expected 32 hexadecimal characters">
				<CircleAlert class="h-3.5 w-3.5" aria-hidden="true" />
			</span>
		{/if}
		<button type="submit" class="btn btn-xs" disabled={!traceIdValid}>Go</button>
	</form>
</div>
