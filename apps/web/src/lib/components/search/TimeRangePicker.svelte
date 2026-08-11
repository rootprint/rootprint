<script lang="ts">
	import { format, fromUnixTime, getUnixTime } from 'date-fns';
	import { ChevronDown } from 'lucide-svelte';

	import {
		formatTimeRangeLabel,
		PRESET_LABELS,
		PRESET_OPTIONS,
		presetDurationSec,
		type Preset
	} from '$lib/utils/time-range';
	import { parseLocalDateTime } from '$lib/utils/time';
	import type { TimeRange } from '$lib/types';

	let {
		value,
		onChange
	}: {
		value: TimeRange;
		onChange: (next: TimeRange) => void;
	} = $props();

	const label = $derived(formatTimeRangeLabel(value));

	const dd = $props.id();
	let panelEl = $state<HTMLDivElement | null>(null);

	function close() {
		panelEl?.togglePopover(false);
	}

	function selectPreset(preset: Preset) {
		onChange({ type: 'relative', preset });
		close();
	}

	let dateStart = $state('');
	let timeStart = $state('');
	let dateEnd = $state('');
	let timeEnd = $state('');

	function seedDraft(v: TimeRange) {
		let startSec: number;
		let endSec: number;
		if (v.type === 'absolute') {
			startSec = v.start;
			endSec = v.end;
		} else {
			endSec = getUnixTime(new Date());
			startSec = endSec - presetDurationSec(v.preset);
		}
		dateStart = format(fromUnixTime(startSec), 'yyyy-MM-dd');
		timeStart = format(fromUnixTime(startSec), 'HH:mm');
		dateEnd = format(fromUnixTime(endSec), 'yyyy-MM-dd');
		timeEnd = format(fromUnixTime(endSec), 'HH:mm');
	}

	function onToggle(e: Event) {
		if ((e as ToggleEvent).newState === 'open') seedDraft(value);
	}

	const startSec = $derived(parseLocalDateTime(dateStart, timeStart));
	const endSec = $derived(parseLocalDateTime(dateEnd, timeEnd));

	const isValid = $derived(startSec !== null && endSec !== null && endSec > startSec);

	const validationMessage = $derived.by(() => {
		if (startSec === null || endSec === null) return 'Enter a date and a time as HH:MM';
		if (endSec <= startSec) return 'End must be after start';
		return '';
	});

	function apply() {
		if (startSec === null || endSec === null || endSec <= startSec) return;
		onChange({ type: 'absolute', start: startSec, end: endSec });
		close();
	}
</script>

<button
	type="button"
	popovertarget={dd}
	style="anchor-name:--{dd}"
	class="border-base-content/20 bg-base-100 hover:bg-base-200 flex h-8 cursor-pointer items-center gap-2 rounded border px-2 text-xs select-none focus:outline-none"
>
	<span>{label}</span>
	<ChevronDown class="h-3 w-3 opacity-60" />
</button>

<div
	bind:this={panelEl}
	popover
	id={dd}
	style="position-anchor:--{dd}"
	ontoggle={onToggle}
	class="dropdown dropdown-end border-line rounded-box bg-base-100 mt-1 flex border"
>
	<div class="border-line flex w-44 flex-col border-r p-3">
		<p class="eyebrow mb-2">Ranges</p>
		{#each PRESET_OPTIONS as preset (preset)}
			{@const active = value.type === 'relative' && value.preset === preset}
			<button
				type="button"
				class="-mx-3 flex items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors {active
					? 'bg-base-content text-base-100'
					: 'text-base-content hover:bg-base-200'}"
				onclick={() => selectPreset(preset)}
			>
				<span>{PRESET_LABELS[preset]}</span>
				<span class="opacity-60">{preset}</span>
			</button>
		{/each}
	</div>

	<div class="flex w-72 flex-col p-3">
		<p class="eyebrow mb-2">Absolute range</p>

		<p class="eyebrow mb-1">From</p>
		<div class="flex gap-2">
			<input
				type="date"
				class="input input-sm flex-1 font-mono"
				aria-describedby="time-range-error"
				bind:value={dateStart}
				onkeydown={(e) => {
					if (e.key === 'Enter') apply();
				}}
			/>
			<input
				type="text"
				inputmode="numeric"
				pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
				placeholder="HH:MM"
				maxlength="5"
				class="input input-sm w-20 font-mono"
				aria-describedby="time-range-error"
				bind:value={timeStart}
				onkeydown={(e) => {
					if (e.key === 'Enter') apply();
				}}
			/>
		</div>

		<p class="eyebrow mt-2 mb-1">To</p>
		<div class="flex gap-2">
			<input
				type="date"
				class="input input-sm flex-1 font-mono"
				aria-describedby="time-range-error"
				bind:value={dateEnd}
				onkeydown={(e) => {
					if (e.key === 'Enter') apply();
				}}
			/>
			<input
				type="text"
				inputmode="numeric"
				pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
				placeholder="HH:MM"
				maxlength="5"
				class="input input-sm w-20 font-mono"
				aria-describedby="time-range-error"
				bind:value={timeEnd}
				onkeydown={(e) => {
					if (e.key === 'Enter') apply();
				}}
			/>
		</div>

		<p id="time-range-error" class="text-error mt-2 min-h-4 text-xs" aria-live="polite">
			{validationMessage}
		</p>

		<div class="mt-auto flex justify-end gap-2 pt-3">
			<button type="button" class="btn btn-ghost btn-sm" onclick={close}>Cancel</button>
			<button type="button" class="btn btn-primary btn-sm" disabled={!isValid} onclick={apply}>
				Apply
			</button>
		</div>
	</div>
</div>
