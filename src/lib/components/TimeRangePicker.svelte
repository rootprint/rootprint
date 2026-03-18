<script lang="ts">
	import { TIME_PRESETS, type TimeRange, type TimezoneMode } from '$lib/types';
	import { formatTimeRangeLabel } from '$lib/utils/time';
	import Calendar from './Calendar.svelte';
	import Icon from '@iconify/svelte';

	let {
		value = { type: 'relative', preset: '15m' } as TimeRange,
		timezoneMode = 'local' as TimezoneMode,
		onchange,
		ontimezonechange
	}: {
		value?: TimeRange;
		timezoneMode?: TimezoneMode;
		onchange: (range: TimeRange) => void;
		ontimezonechange: (mode: TimezoneMode) => void;
	} = $props();

	let open = $state(false);
	let container = $state<HTMLDivElement | null>(null);

	// Custom date range state
	let fromDate = $state<Date | null>(null);
	let toDate = $state<Date | null>(null);
	let fromTime = $state('00:00');
	let toTime = $state('23:59');
	let selectionMode = $state<'from' | 'to'>('from');

	$effect(() => {
		if (value.type === 'absolute') {
			const start = new Date(value.start * 1000);
			const end = new Date(value.end * 1000);
			fromDate = start;
			toDate = end;
			fromTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
			toTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
		}
	});

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function selectPreset(code: string) {
		onchange({ type: 'relative', preset: code });
		close();
	}

	function applyCustomRange() {
		if (!fromDate || !toDate) return;
		const [fh, fm] = fromTime.split(':').map(Number);
		const [th, tm] = toTime.split(':').map(Number);

		const start = new Date(fromDate);
		start.setHours(fh, fm, 0, 0);
		const end = new Date(toDate);
		end.setHours(th, tm, 59, 999);

		if (timezoneMode === 'utc') {
			start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
			end.setMinutes(end.getMinutes() + end.getTimezoneOffset());
		}

		onchange({
			type: 'absolute',
			start: Math.floor(start.getTime() / 1000),
			end: Math.floor(end.getTime() / 1000)
		});
		close();
	}

	function handleWindowClick(e: MouseEvent) {
		if (container && !container.contains(e.target as Node)) {
			close();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	let buttonLabel = $derived(formatTimeRangeLabel(value, timezoneMode));
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />
<!-- TODO: Rethink how to place this and display -->
<div class="relative" bind:this={container}>
	<!-- Trigger button -->
	<button class="btn gap-2 border-base-content/20 bg-base-100 font-normal btn-sm" onclick={toggle}>
		<span class="text-sm">{buttonLabel}</span>
		<span class="text-base-content/50">|</span>
		<span class="text-sm text-base-content/70">
			{timezoneMode === 'utc' ? 'UTC' : 'Local'}
			<span class="text-[10px] ml-0.5 {open ? 'inline-block rotate-180' : ''}">▾</span>
		</span>
	</button>

	<!-- Dropdown panel -->
	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute top-full right-0 z-50 mt-1 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-lg"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex">
				<!-- Preset list -->
				<div class="w-48 border-r border-base-300 py-1">
					{#each TIME_PRESETS as preset (preset.code)}
						{@const isActive = value.type === 'relative' && value.preset === preset.code}
						<button
							class="flex w-full items-center justify-between px-4 py-1.5 text-sm hover:bg-base-200 {isActive
								? 'bg-primary/10 text-primary'
								: ''}"
							onclick={() => selectPreset(preset.code)}
						>
							<span>{preset.label}</span>
							<span class="text-xs text-base-content/60">{preset.code}</span>
						</button>
					{/each}
				</div>

				<!-- Custom date range -->
				<div class="p-3">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-base-content/60">Custom Range</span>
						<button
							class="btn btn-xs btn-primary"
							disabled={!fromDate || !toDate}
							onclick={applyCustomRange}
						>
							Apply
						</button>
					</div>

					<div class="mb-2 flex">
						<div class="join w-full">
							<button
								class="btn join-item flex-1 btn-xs {selectionMode === 'from' ? 'btn-primary' : ''}"
								onclick={() => (selectionMode = 'from')}
							>
								From{fromDate
									? `: ${fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
									: ''}
							</button>
							<button
								class="btn join-item flex-1 btn-xs {selectionMode === 'to' ? 'btn-primary' : ''}"
								onclick={() => (selectionMode = 'to')}
							>
								To{toDate
									? `: ${toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
									: ''}
							</button>
						</div>
					</div>

					<Calendar
						selected={selectionMode === 'from' ? fromDate : toDate}
						rangeStart={fromDate}
						rangeEnd={toDate}
						onselect={(d) => {
							if (selectionMode === 'from') {
								fromDate = d;
								if (toDate && d > toDate) toDate = null;
								selectionMode = 'to';
							} else {
								if (fromDate && d < fromDate) {
									toDate = fromDate;
									fromDate = d;
								} else {
									toDate = d;
								}
							}
						}}
						month={selectionMode === 'to' && toDate ? toDate : (fromDate ?? new Date())}
						timezone={timezoneMode}
					/>

					<div class="mt-2 flex gap-2">
						<div class="flex-1">
							<span class="text-xs text-base-content/60">From</span>
							<input
								type="time"
								class="input-bordered input input-xs w-full"
								bind:value={fromTime}
							/>
						</div>
						<div class="flex-1">
							<span class="text-xs text-base-content/60">To</span>
							<input type="time" class="input-bordered input input-xs w-full" bind:value={toTime} />
						</div>
					</div>
				</div>
			</div>

			<!-- Timezone footer -->
			<div class="flex items-center justify-between border-t border-base-300 px-4 py-2 text-xs">
				<Icon icon="mdi:clock-outline" class="text-sm text-base-content/50" />
				<div class="join">
					<button
						class="btn join-item btn-xs {timezoneMode === 'utc' ? 'btn-accent' : ''}"
						onclick={() => ontimezonechange('utc')}
					>
						UTC
					</button>
					<button
						class="btn join-item btn-xs {timezoneMode === 'local' ? 'btn-accent' : ''}"
						onclick={() => ontimezonechange('local')}
					>
						Browser time
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
