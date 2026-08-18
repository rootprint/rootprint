<script lang="ts">
	import { tick } from 'svelte';
	import { Check, ChevronDown, Search } from 'lucide-svelte';

	let {
		services,
		value,
		onChange
	}: {
		services: string[];
		value: string | null;
		onChange: (service: string) => void;
	} = $props();

	const dd = $props.id();
	const listboxId = `${dd}-listbox`;
	let panelEl = $state<HTMLDivElement | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(0);

	const options = $derived.by(() => {
		const names = value !== null && !services.includes(value) ? [value, ...services] : services;
		return [
			{ value: '', label: 'All services' },
			...names.map((name) => ({ value: name, label: name }))
		];
	});
	const filtered = $derived.by(() => {
		const normalized = query.trim().toLowerCase();
		return normalized === ''
			? options
			: options.filter((option) => option.label.toLowerCase().includes(normalized));
	});
	const label = $derived(value ?? 'All services');

	function close() {
		panelEl?.togglePopover(false);
	}

	function choose(next: string) {
		close();
		onChange(next);
	}

	function focusActive() {
		void tick().then(() => {
			document.getElementById(`${dd}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
		});
	}

	function moveActive(direction: number) {
		if (filtered.length === 0) return;
		activeIndex = (activeIndex + direction + filtered.length) % filtered.length;
		focusActive();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActive(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActive(-1);
		} else if (event.key === 'Enter' && filtered[activeIndex]) {
			event.preventDefault();
			choose(filtered[activeIndex].value);
		}
	}

	function onToggle(event: Event) {
		open = (event as ToggleEvent).newState === 'open';
		if (!open) return;
		query = '';
		activeIndex = Math.max(
			0,
			options.findIndex((option) => option.value === (value ?? ''))
		);
		void tick().then(() => searchEl?.focus());
	}
</script>

<div class="grid w-fit min-w-0 gap-1.5">
	<span id={`${dd}-label`} class="text-base-content/60 text-[10px] tracking-wide uppercase">
		Service
	</span>
	<button
		type="button"
		popovertarget={dd}
		style="anchor-name:--{dd}"
		class="border-base-content/20 bg-base-100 hover:bg-base-200 flex h-8 w-56 cursor-pointer items-center justify-between gap-2 rounded border px-2 text-xs sm:w-64"
		aria-labelledby={`${dd}-label`}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="truncate">{label}</span>
		<ChevronDown class="size-3 shrink-0 opacity-60" aria-hidden="true" />
	</button>
</div>

<div
	bind:this={panelEl}
	popover
	id={dd}
	style="position-anchor:--{dd}"
	ontoggle={onToggle}
	class="dropdown border-line rounded-box bg-base-100 mt-1 w-64 border"
>
	<div class="border-line border-b p-2">
		<label class="input input-sm w-full">
			<Search class="size-3.5 opacity-60" aria-hidden="true" />
			<input
				bind:this={searchEl}
				bind:value={query}
				type="search"
				role="combobox"
				placeholder="Search services…"
				aria-label="Search services"
				aria-expanded="true"
				aria-controls={listboxId}
				aria-activedescendant={filtered[activeIndex] ? `${dd}-option-${activeIndex}` : undefined}
				oninput={() => (activeIndex = 0)}
				onkeydown={onKeydown}
			/>
		</label>
	</div>
	<div id={listboxId} role="listbox" aria-label="Services" class="max-h-64 overflow-y-auto py-1">
		{#if filtered.length === 0}
			<p class="text-base-content/50 px-3 py-6 text-center text-xs">No matching services.</p>
		{:else}
			{#each filtered as option, index (option.value)}
				<button
					id={`${dd}-option-${index}`}
					type="button"
					role="option"
					aria-selected={option.value === (value ?? '')}
					class="hover:bg-base-200 flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs"
					class:bg-base-200={index === activeIndex}
					onmousemove={() => (activeIndex = index)}
					onclick={() => choose(option.value)}
				>
					<span class="truncate">{option.label}</span>
					{#if option.value === (value ?? '')}
						<Check class="size-3.5 shrink-0" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		{/if}
	</div>
</div>
