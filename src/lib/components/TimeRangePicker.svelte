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

<div class="relative" bind:this={container}>
	<!-- Trigger button -->
	<button class="btn gap-1 border-base-content/20 bg-base-100 font-normal btn-sm" onclick={toggle}>
		<Icon icon="mdi:clock-outline" class="text-base" />
		<span class="text-sm">{buttonLabel}</span>
		<Icon
			icon="mdi:chevron-down"
			class="text-base transition-transform {open ? 'rotate-180' : ''}"
		/>
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
							<span class="text-xs text-base-content/40">{preset.code}</span>
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

					<div class="flex gap-4">
						<div>
							<span class="mb-1 block text-xs font-medium text-base-content/60">From</span>
							<Calendar
								selected={fromDate}
								onselect={(d) => (fromDate = d)}
								maxDate={toDate ?? undefined}
								timezone={timezoneMode}
							/>
							<input
								type="time"
								class="input-bordered input input-xs mt-1 w-full"
								bind:value={fromTime}
							/>
						</div>

						<div>
							<span class="mb-1 block text-xs font-medium text-base-content/60">To</span>
							<Calendar
								selected={toDate}
								onselect={(d) => (toDate = d)}
								minDate={fromDate ?? undefined}
								timezone={timezoneMode}
							/>
							<input
								type="time"
								class="input-bordered input input-xs mt-1 w-full"
								bind:value={toTime}
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Timezone footer -->
			<div class="flex items-center justify-between border-t border-base-300 px-4 py-2 text-xs">
				<Icon icon="mdi:clock-outline" class="text-sm text-base-content/50" />
				<div class="join">
					<button
						class="btn join-item btn-xs {timezoneMode === 'utc' ? 'btn-primary' : ''}"
						onclick={() => ontimezonechange('utc')}
					>
						UTC
					</button>
					<button
						class="btn join-item btn-xs {timezoneMode === 'local' ? 'btn-primary' : ''}"
						onclick={() => ontimezonechange('local')}
					>
						Browser time
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
