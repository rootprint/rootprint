<script lang="ts">
	import type { ExploreOperation } from '$lib/api/traces';
	import { rowActivate } from '$lib/attachments/row-activate';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import SortButton from '$lib/components/ui/SortButton.svelte';
	import { formatCount, formatDurationMs, formatPercent, formatRate } from '$lib/utils/format';
	import { serviceColor } from '$lib/utils/service-color';

	type Props = {
		operations: ExploreOperation[];
		truncated: boolean;
		onSelect: (operation: ExploreOperation) => void;
	};

	let { operations, truncated, onSelect }: Props = $props();

	type SortKey = 'operation' | 'requests' | 'errorRate' | 'p95';

	let sortKey = $state<SortKey>('requests');
	let descending = $state(true);

	const errorRate = (op: ExploreOperation) => (op.requests === 0 ? 0 : op.errors / op.requests);

	const SORT_VALUE: Record<SortKey, (op: ExploreOperation) => number | string> = {
		operation: (op) => op.operation.toLowerCase(),
		requests: (op) => op.requests,
		errorRate,
		p95: (op) => op.p95 ?? -1
	};

	const rows = $derived.by(() => {
		const value = SORT_VALUE[sortKey];
		return operations.toSorted((a, b) => {
			const x = value(a);
			const y = value(b);
			const order = x < y ? -1 : x > y ? 1 : 0;
			return descending ? -order : order;
		});
	});

	function sortBy(key: SortKey) {
		if (sortKey === key) {
			descending = !descending;
			return;
		}
		sortKey = key;
		descending = key !== 'operation';
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return descending ? 'descending' : 'ascending';
	}

	function sparkPoints(spark: number[]): string {
		const max = Math.max(1, ...spark);
		const step = spark.length > 1 ? 100 / (spark.length - 1) : 0;
		return spark
			.map((count, i) => `${(i * step).toFixed(2)},${(23 - (count / max) * 22).toFixed(2)}`)
			.join(' ');
	}
</script>

{#if operations.length === 0}
	<EmptyPanel title="No spans match these filters">
		Try a wider time range or fewer filters.
	</EmptyPanel>
{:else}
	<section class="flex flex-col gap-2" aria-label="Operations">
		<div class="border-line rounded-box overflow-x-auto border">
			<table class="table-xs table min-w-[760px] text-xs">
				<thead>
					<tr class="bg-base-200/70 text-muted font-medium">
						<th scope="col" aria-sort={ariaSort('operation')}>
							<SortButton
								label="Operation"
								direction={ariaSort('operation')}
								onclick={() => sortBy('operation')}
							/>
						</th>
						<th scope="col">Services</th>
						<th scope="col" class="text-right" aria-sort={ariaSort('requests')}>
							<SortButton
								label="Requests"
								direction={ariaSort('requests')}
								onclick={() => sortBy('requests')}
							/>
						</th>
						<th scope="col" class="text-right" aria-sort={ariaSort('errorRate')}>
							<SortButton
								label="Errors"
								direction={ariaSort('errorRate')}
								onclick={() => sortBy('errorRate')}
							/>
						</th>
						<th scope="col" class="text-right" aria-sort={ariaSort('p95')}>
							<SortButton label="P95" direction={ariaSort('p95')} onclick={() => sortBy('p95')} />
						</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as op (op.operation)}
						<tr
							class="border-line hover:bg-base-200/60 cursor-pointer border-b last:border-b-0"
							{@attach rowActivate(() => () => onSelect(op))}
						>
							<td class="max-w-sm py-2 font-mono">
								<!-- The keyboard path; rowActivate skips clicks that land on this button. -->
								<button
									type="button"
									class="block max-w-full truncate text-left hover:underline"
									title={op.operation}
									aria-label={`Show spans for ${op.operation}`}
									onclick={() => onSelect(op)}
								>
									{op.operation}
								</button>
							</td>
							<td>
								<div class="flex flex-wrap gap-1">
									{#each op.services as service (service)}
										<span
											class="border-line inline-flex items-center gap-1 rounded border px-1.5 font-mono"
										>
											<span
												class="status"
												style="background-color: {serviceColor(service)}"
												aria-hidden="true"
											></span>
											{service}
										</span>
									{/each}
								</div>
							</td>
							<td class="text-right">
								<div class="flex items-center justify-end gap-2">
									<svg
										viewBox="0 0 100 24"
										preserveAspectRatio="none"
										class="h-6 w-24"
										aria-hidden="true"
									>
										<polyline
											points={sparkPoints(op.spark)}
											fill="none"
											stroke={serviceColor(op.services[0] ?? op.operation)}
											stroke-width="1.5"
											vector-effect="non-scaling-stroke"
										/>
									</svg>
									<span class="w-14 tabular-nums">
										{formatCount(op.requests)}
										<span class="text-subtle block">
											{formatRate(op.ratePerSec * 60)}/min
										</span>
									</span>
								</div>
							</td>
							<td class={['text-right tabular-nums', op.errors > 0 && 'text-error']}>
								{formatPercent(errorRate(op))} · {formatCount(op.errors)}
							</td>
							<td class="text-right tabular-nums">{formatDurationMs(op.p95)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if truncated}
			<p class="text-subtle text-xs">Showing the top 200 operations by volume.</p>
		{/if}
	</section>
{/if}
