<script lang="ts">
	let {
		selected = null,
		month = new Date(),
		minDate,
		maxDate,
		rangeStart,
		rangeEnd,
		onselect
	}: {
		selected?: Date | null;
		month?: Date;
		minDate?: Date;
		maxDate?: Date;
		rangeStart?: Date | null;
		rangeEnd?: Date | null;
		onselect: (date: Date) => void;
	} = $props();

	let viewYear = $state(month.getFullYear());
	let viewMonth = $state(month.getMonth());
	let lastMonth = month;

	$effect(() => {
		if (month !== lastMonth) {
			viewYear = month.getFullYear();
			viewMonth = month.getMonth();
			lastMonth = month;
		}
	});

	function daysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function firstDayOfWeek(year: number, month: number): number {
		const day = new Date(year, month, 1).getDay();
		return day === 0 ? 6 : day - 1; // Monday = 0
	}

	let days = $derived.by(() => {
		const total = daysInMonth(viewYear, viewMonth);
		const offset = firstDayOfWeek(viewYear, viewMonth);
		const cells: (number | null)[] = [];
		for (let i = 0; i < offset; i++) cells.push(null);
		for (let d = 1; d <= total; d++) cells.push(d);
		return cells;
	});

	const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
	const MONTHS = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	function prevMonth() {
		if (viewMonth === 0) {
			viewYear--;
			viewMonth = 11;
		} else viewMonth--;
	}
	function nextMonth() {
		if (viewMonth === 11) {
			viewYear++;
			viewMonth = 0;
		} else viewMonth++;
	}
	function prevYear() {
		viewYear--;
	}
	function nextYear() {
		viewYear++;
	}

	function isSameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function isInRange(day: number): boolean {
		if (!rangeStart || !rangeEnd) return false;
		const d = new Date(viewYear, viewMonth, day);
		return d >= rangeStart && d <= rangeEnd;
	}

	function isDisabled(day: number): boolean {
		const d = new Date(viewYear, viewMonth, day);
		if (minDate && d < minDate) return true;
		if (maxDate && d > maxDate) return true;
		return false;
	}
</script>

<div class="w-64">
	<div class="mb-1 flex items-center justify-between">
		<div class="flex gap-0.5">
			<button class="btn btn-ghost btn-xs" onclick={prevYear}>«</button>
			<button class="btn btn-ghost btn-xs" onclick={prevMonth}>‹</button>
		</div>
		<span class="text-sm font-medium">{MONTHS[viewMonth]} {viewYear}</span>
		<div class="flex gap-0.5">
			<button class="btn btn-ghost btn-xs" onclick={nextMonth}>›</button>
			<button class="btn btn-ghost btn-xs" onclick={nextYear}>»</button>
		</div>
	</div>

	<div class="mb-1 grid grid-cols-7 text-center text-xs text-base-content/50">
		{#each WEEKDAYS as wd (wd)}
			<span>{wd}</span>
		{/each}
	</div>

	<div class="grid grid-cols-7 gap-px">
		{#each days as day, i (i)}
			{#if day === null}
				<span></span>
			{:else}
				{@const date = new Date(viewYear, viewMonth, day)}
				{@const isSelected = selected && isSameDay(date, selected)}
				{@const inRange = isInRange(day)}
				{@const disabled = isDisabled(day)}
				<button
					class="btn h-8 btn-ghost btn-xs {isSelected ? 'btn-primary' : ''} {inRange && !isSelected
						? 'bg-primary/20'
						: ''}"
					{disabled}
					onclick={() => onselect(date)}
				>
					{day}
				</button>
			{/if}
		{/each}
	</div>
</div>
