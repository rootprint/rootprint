<script lang="ts">
	import { DEPENDENCY_SPANS } from 'api/constants';

	import type { ServiceHealthDependency } from '$lib/api/services';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import TracesLink from '$lib/components/ui/TracesLink.svelte';
	import { formatCount, formatDurationMs } from '$lib/utils/format';

	type Props = {
		dependencies: ServiceHealthDependency[];
		service: string;
	};

	let { dependencies, service }: Props = $props();
</script>

<section class="flex flex-col gap-2" aria-labelledby="dependency-heading">
	<div>
		<h2 id="dependency-heading" class="section-label">Downstream calls</h2>
		<p class="text-muted mt-1 text-xs">
			Outbound client and producer spans emitted by
			<span class="font-mono">{service}</span>, ranked by total time.
		</p>
	</div>
	{#if dependencies.length === 0}
		<EmptyPanel title="No outbound calls">
			No client or producer spans from <span class="font-mono">{service}</span> in this range.
		</EmptyPanel>
	{:else}
		<div class="border-line rounded-box overflow-x-auto border">
			<table class="table-xs table min-w-[600px] text-xs">
				<thead>
					<tr class="bg-base-200/70 text-muted font-medium">
						<th scope="col">Call</th>
						<th scope="col" class="text-right">Calls</th>
						<th scope="col" class="text-right">p50 latency</th>
						<th scope="col" class="text-right">p95 latency</th>
						<th scope="col" class="text-right">Total time</th>
						<th scope="col" class="w-8"><span class="sr-only">Traces</span></th>
					</tr>
				</thead>
				<tbody>
					{#each dependencies as dependency (dependency.name)}
						<tr class="border-line border-b last:border-b-0">
							<td class="max-w-md py-2 font-mono">
								<div class="truncate" title={dependency.name}>{dependency.name}</div>
								{#if dependency.peers.length > 0}
									<div class="text-subtle mt-0.5 truncate" title={dependency.peers.join(', ')}>
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
							<td class="w-8 text-right">
								<TracesLink
									filters={{ service, operation: dependency.name, q: DEPENDENCY_SPANS }}
									subject={dependency.name}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
