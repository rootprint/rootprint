<script lang="ts">
	import type { ServiceHealthEndpoint } from '$lib/api/monitoring';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import RowLimitSelector from '$lib/components/ui/RowLimitSelector.svelte';
	import { formatDurationMs } from '$lib/utils/format';
	import { readString, writeString } from '$lib/utils/safe-storage';

	type Props = {
		/** Already ranked and capped at `LIMITS`' largest entry by the API. */
		endpoints: ServiceHealthEndpoint[];
		/** Off when the view is already scoped to one service. */
		showService: boolean;
	};

	let { endpoints, showService }: Props = $props();

	const LIMITS = [10, 20, 30] as const;
	const STORAGE_KEY = 'rootprint:endpoint-rows';

	let limit = $state<number>(
		LIMITS.find((l) => String(l) === readString(STORAGE_KEY)) ?? LIMITS[0]
	);
	const rows = $derived(endpoints.slice(0, limit));

	function selectLimit(next: number) {
		limit = next;
		writeString(STORAGE_KEY, String(next));
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="endpoint-heading">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="endpoint-heading" class="section-label">Highest-impact endpoints</h2>
			<p class="text-muted mt-1 text-xs">
				Ranked by total time spent handling requests in the selected range.
			</p>
		</div>
		<RowLimitSelector value={limit} options={LIMITS} onChange={selectLimit} />
	</div>
	{#if endpoints.length === 0}
		<EmptyPanel title="Endpoint data unavailable">
			Server spans were found, but no endpoint operation names were recorded.
		</EmptyPanel>
	{:else}
		<div class="border-line rounded-box overflow-x-auto border">
			<table class="table-xs table min-w-[680px] text-xs">
				<thead>
					<tr class="bg-base-200/70 text-muted font-medium">
						<th scope="col" class="w-10 text-right" aria-label="Rank">#</th>
						<th scope="col">Endpoint</th>
						<th scope="col" class="text-right">Requests</th>
						<th scope="col" class="text-right">p50 latency</th>
						<th scope="col" class="text-right">p95 latency</th>
						<th scope="col" class="text-right">Total time</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as endpoint, index (endpoint.id)}
						<tr class="border-line/40 even:bg-base-200/50 border-b last:border-b-0">
							<td class="w-10 text-right tabular-nums">
								{index + 1}
							</td>
							<td class="max-w-md py-2 font-mono">
								<div class="flex min-w-0 items-center gap-2" title={endpoint.name}>
									<span class="truncate">{endpoint.name}</span>
									{#if !endpoint.routeAvailable}
										<span
											class="border-warning/30 bg-warning/10 text-warning-ink shrink-0 rounded border px-1.5 font-sans text-xs"
											title="No OpenTelemetry HTTP route or path was recorded"
										>
											Route unavailable
										</span>
									{/if}
								</div>
								{#if showService}
									<div class="text-subtle mt-0.5 truncate" title={endpoint.service}>
										{endpoint.service}
									</div>
								{/if}
							</td>
							<td class="text-right tabular-nums">{endpoint.requests.toLocaleString()}</td>
							<td class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMs(endpoint.p50)}
							</td>
							<td class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMs(endpoint.p95)}
							</td>
							<td class="text-right font-medium whitespace-nowrap tabular-nums">
								{formatDurationMs(endpoint.totalMillis)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
