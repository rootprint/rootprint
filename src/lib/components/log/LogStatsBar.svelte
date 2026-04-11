<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';

	import CollapsibleSection from '$lib/components/ui/CollapsibleSection.svelte';
	import type { IndexField, LogStatsData } from '$lib/types';
	import { getLevelColor, getValueColor } from '$lib/utils/log-helpers';

	let {
		data,
		loading,
		currentField,
		availableFields,
		levelField,
		onFieldChange,
		onSegmentClick,
		collapsed = $bindable(false)
	}: {
		data: LogStatsData | null;
		loading: boolean;
		currentField: string | null;
		availableFields: IndexField[];
		levelField: string;
		onFieldChange: (field: string) => void;
		onSegmentClick: (field: string, value: string) => void;
		collapsed: boolean;
	} = $props();

	let dropdownOpen = $state(false);

	const sortedFields = $derived.by(() => {
		const level = availableFields.find((f) => f.name === levelField);
		const rest = availableFields
			.filter((f) => f.name !== levelField)
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name));
		return level ? [level, ...rest] : rest;
	});

	type Segment = {
		key: string;
		value: string;
		count: number;
		percent: number;
		color: string;
		isOther: boolean;
	};

	const segments = $derived.by<Segment[]>(() => {
		if (!data || data.totalCount === 0) return [];
		const result: Segment[] = data.buckets.map((b, i) => ({
			key: b.value,
			value: b.value,
			count: b.count,
			percent: (b.count / data.totalCount) * 100,
			color:
				currentField === levelField
					? getLevelColor(b.value) || getValueColor(i)
					: getValueColor(i),
			isOther: false
		}));
		if (data.otherCount > 0) {
			result.push({
				key: '__other__',
				value: 'other',
				count: data.otherCount,
				percent: (data.otherCount / data.totalCount) * 100,
				color: '#888',
				isOther: true
			});
		}
		return result;
	});

	function selectField(field: string) {
		dropdownOpen = false;
		if (field !== currentField) {
			onFieldChange(field);
		}
	}

	function handleSegmentClick(segment: Segment) {
		if (segment.isOther || currentField === null) return;
		onSegmentClick(currentField, segment.value);
	}
</script>

{#if currentField !== null}
	<div class="relative border-b border-base-300">
		<CollapsibleSection title="Group by" bind:collapsed>
			{#snippet headerActions()}
				<div class="flex items-center gap-2">
					{#if loading && data === null}
						<span class="loading loading-xs loading-spinner text-base-content/60"></span>
					{/if}
					{#if dropdownOpen}
						<div
							role="none"
							class="fixed inset-0 z-10"
							onclick={() => (dropdownOpen = false)}
						></div>
					{/if}
					<div class="dropdown dropdown-end" class:dropdown-open={dropdownOpen}>
						<button
							type="button"
							class="btn btn-xs"
							onclick={() => (dropdownOpen = !dropdownOpen)}
							title="Change group-by field"
						>
							<span class="font-mono text-[11px]">{currentField}</span>
							<ChevronDown size={12} />
						</button>
						{#if dropdownOpen}
							<div
								class="dropdown-content menu z-20 mt-1 max-h-80 w-56 overflow-y-auto rounded-box bg-base-200 p-2 shadow-lg"
							>
								{#each sortedFields as field, i (field.name)}
									<button
										type="button"
										class="btn justify-start btn-ghost btn-xs {field.name === currentField
											? 'btn-active'
											: ''}"
										onclick={() => selectField(field.name)}
									>
										<span class="truncate font-mono text-[11px]">{field.name}</span>
									</button>
									{#if i === 0 && field.name === levelField && sortedFields.length > 1}
										<div class="divider my-0"></div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/snippet}

			<div class="px-3 pb-3">
				{#if loading && data === null}
					<div class="h-3 w-full rounded bg-base-300/60"></div>
				{:else if !data || data.totalCount === 0}
					<p class="py-1 text-xs text-base-content/50">
						No values for this field in the current window
					</p>
				{:else}
					<div class="flex h-3.5 w-full gap-px overflow-hidden rounded">
						{#each segments as seg (seg.key)}
							<button
								type="button"
								class="min-w-[2px] cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
								style="flex-basis: {seg.percent}%; background-color: {seg.color};"
								title="{seg.value}: {seg.count.toLocaleString()} hits"
								aria-label="{seg.value}: {seg.count.toLocaleString()} hits"
								disabled={seg.isOther}
								onclick={() => handleSegmentClick(seg)}
							></button>
						{/each}
					</div>
					<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-base-content/80">
						{#each segments as seg (seg.key)}
							<button
								type="button"
								class="flex items-center gap-1.5 {seg.isOther
									? 'cursor-default'
									: 'cursor-pointer hover:underline'}"
								disabled={seg.isOther}
								onclick={() => handleSegmentClick(seg)}
							>
								<span
									class="inline-block h-2 w-2 rounded-sm"
									style="background-color: {seg.color};"
								></span>
								<span class="max-w-[140px] truncate" title={seg.value}>{seg.value}</span>
								<span class="tabular-nums text-base-content/60">{seg.count.toLocaleString()}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</CollapsibleSection>
	</div>
{/if}
