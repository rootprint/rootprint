<script lang="ts">
	import type { ServiceHealthFailingOperation } from '$lib/api/monitoring';
	import { formatCount } from '$lib/utils/format';

	type Props = {
		operations: ServiceHealthFailingOperation[];
		showService: boolean;
	};

	let { operations, showService }: Props = $props();

	const totalErrors = $derived(operations.reduce((sum, operation) => sum + operation.errors, 0));
	const maxErrors = $derived(Math.max(...operations.map((operation) => operation.errors), 1));
</script>

<section class="flex flex-col gap-2" aria-labelledby="failing-operations-heading">
	<div>
		<h2 id="failing-operations-heading" class="eyebrow">Top failing operations</h2>
		<p class="text-base-content/50 mt-1 text-xs">
			Server spans reporting an error status, by operation name.
		</p>
	</div>
	<div class="border-line rounded-box divide-line divide-y overflow-hidden border">
		<div class="bg-base-200/70 flex items-center justify-between px-4 py-2">
			<span class="text-base-content/50 text-[10px] tracking-wide uppercase"
				>Error concentration</span
			>
			<span class="font-mono text-xs tabular-nums">{formatCount(totalErrors)} ranked errors</span>
		</div>
		{#each operations as operation, index (operation.service + ' ' + operation.name)}
			<div class="grid grid-cols-[1.5rem_minmax(0,1fr)_4rem] items-center gap-3 px-4 py-3">
				<span class="text-base-content/35 font-mono text-[10px] tabular-nums">
					{String(index + 1).padStart(2, '0')}
				</span>
				<div class="min-w-0">
					<div class="truncate font-mono text-xs" title={operation.name}>{operation.name}</div>
					{#if showService && operation.service !== ''}
						<div
							class="text-base-content/40 mt-0.5 truncate font-mono text-[10px]"
							title={operation.service}
						>
							{operation.service}
						</div>
					{/if}
					<div class="bg-base-300 mt-2 h-1 overflow-hidden rounded-full">
						<div
							class="bg-error h-full rounded-full"
							style={`width:${(operation.errors / maxErrors) * 100}%`}
						></div>
					</div>
				</div>
				<span class="text-error text-right font-mono text-xs tabular-nums"
					>{formatCount(operation.errors)}</span
				>
			</div>
		{/each}
	</div>
</section>
