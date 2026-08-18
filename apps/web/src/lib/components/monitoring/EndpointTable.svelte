<script lang="ts">
	import type { ServiceHealthEndpoint } from '$lib/api/monitoring';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import { formatDurationMs } from '$lib/utils/format';

	type Props = {
		endpoints: ServiceHealthEndpoint[];
		limit: number;
		/** Off when the view is already scoped to one service. */
		showService: boolean;
		onLimitChange: (limit: number) => void;
	};

	let { endpoints, limit, showService, onLimitChange }: Props = $props();

	const LIMITS = [10, 20, 30] as const;
</script>

<section class="flex flex-col gap-2" aria-labelledby="endpoint-heading">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="endpoint-heading" class="eyebrow">Highest-impact endpoints</h2>
			<p class="text-base-content/50 mt-1 text-xs">
				Ranked by total time spent handling requests in the selected range.
			</p>
		</div>
		<div class="flex items-center gap-2" aria-label="Rows per page">
			<span class="text-base-content/50 text-[10px] tracking-wide uppercase">Rows</span>
			<div class="border-line divide-line flex divide-x overflow-hidden rounded border">
				{#each LIMITS as option (option)}
					<button
						type="button"
						class="h-7 min-w-9 px-2 text-xs tabular-nums transition-colors {limit === option
							? 'bg-base-content text-base-100'
							: 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}"
						aria-pressed={limit === option}
						onclick={() => onLimitChange(option)}
					>
						{option}
					</button>
				{/each}
			</div>
		</div>
	</div>
	{#if endpoints.length === 0}
		<EmptyPanel title="Endpoint data unavailable">
			Server spans were found, but no endpoint operation names were recorded.
		</EmptyPanel>
	{:else}
		<div class="border-line rounded-box overflow-x-auto border">
			<table class="table-xs table min-w-[680px]">
				<thead>
					<tr
						class="bg-base-200/70 text-base-content/60 text-[10px] font-medium tracking-wide uppercase"
					>
						<th scope="col" class="w-10 text-right" aria-label="Rank">#</th>
						<th scope="col">Endpoint</th>
						<th scope="col" class="text-right">Requests</th>
						<th scope="col" class="text-right">p50 latency</th>
						<th scope="col" class="text-right">p95 latency</th>
						<th scope="col" class="text-right">Total time</th>
					</tr>
				</thead>
				<tbody>
					{#each endpoints as endpoint, index (endpoint.id)}
						<tr class="border-line/40 even:bg-base-200/50 border-b last:border-b-0">
							<td class="w-10 text-right font-mono text-xs tabular-nums">
								{index + 1}
							</td>
							<td class="max-w-md py-2 font-mono text-xs">
								<div class="flex min-w-0 items-center gap-2" title={endpoint.name}>
									<span class="truncate">{endpoint.name}</span>
									{#if !endpoint.routeAvailable}
										<span
											class="border-warning/30 bg-warning/10 text-warning shrink-0 rounded border px-1.5 font-sans text-[10px]"
											title="No OpenTelemetry HTTP route or path was recorded"
										>
											Route unavailable
										</span>
									{/if}
								</div>
								{#if showService}
									<div
										class="text-base-content/40 mt-0.5 truncate text-[10px]"
										title={endpoint.service}
									>
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
