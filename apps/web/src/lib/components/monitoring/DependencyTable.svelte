<script lang="ts">
	import type { ServiceHealthDependency } from '$lib/api/monitoring';
	import { formatCount, formatDurationMs } from '$lib/utils/format';

	type Props = {
		dependencies: ServiceHealthDependency[];
		service: string;
	};

	let { dependencies, service }: Props = $props();
</script>

<section class="flex flex-col gap-2" aria-labelledby="dependency-heading">
	<div>
		<h2 id="dependency-heading" class="eyebrow">Downstream calls</h2>
		<p class="text-base-content/50 mt-1 text-xs">
			Outbound client and producer spans emitted by
			<span class="font-mono">{service}</span>, ranked by total time.
		</p>
	</div>
	<div class="border-line rounded-box overflow-x-auto border">
		<table class="table-xs table min-w-[600px]">
			<thead>
				<tr
					class="bg-base-200/70 text-base-content/60 text-[10px] font-medium tracking-wide uppercase"
				>
					<th scope="col">Call</th>
					<th scope="col" class="text-right">Calls</th>
					<th scope="col" class="text-right">p50 latency</th>
					<th scope="col" class="text-right">p95 latency</th>
					<th scope="col" class="text-right">Total time</th>
				</tr>
			</thead>
			<tbody>
				{#each dependencies as dependency (dependency.name)}
					<tr class="border-line/40 even:bg-base-200/50 border-b last:border-b-0">
						<td class="max-w-md py-2 font-mono text-xs">
							<div class="truncate" title={dependency.name}>{dependency.name}</div>
							{#if dependency.peers.length > 0}
								<div
									class="text-base-content/40 mt-0.5 truncate text-[10px]"
									title={dependency.peers.join(', ')}
								>
									{dependency.peers.join(', ')}
								</div>
							{/if}
						</td>
						<td class="text-right tabular-nums">{formatCount(dependency.calls)}</td>
						<td class="text-right whitespace-nowrap tabular-nums">
							{formatDurationMs(dependency.p50)}
						</td>
						<td class="text-right whitespace-nowrap tabular-nums">
							{formatDurationMs(dependency.p95)}
						</td>
						<td class="text-right font-medium whitespace-nowrap tabular-nums">
							{formatDurationMs(dependency.totalMillis)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
