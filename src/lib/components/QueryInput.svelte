<script lang="ts">
	import { tick } from 'svelte';
	import type { IndexField } from '$lib/types';
	import { getQueryContext, validateQuery } from '$lib/utils/lucene';

	interface Props {
		externalValue: string;
		fields: IndexField[];
		onsubmit: (query: string) => void;
		onsearchvalues: (field: string, searchTerm: string) => Promise<string[]>;
	}

	let { externalValue, fields, onsubmit, onsearchvalues }: Props = $props();

	// --- Internal state (owns the localBuffer pattern from +page.svelte) ---
	let localBuffer = $state('');
	let focused = $state(false);
	let showDropdown = $state(false);
	let suggestions = $state<string[]>([]);
	let selectedIndex = $state(-1);
	let validationError = $state<string | null>(null);
	let valueDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	let inputEl = $state<HTMLInputElement | null>(null);
	let lastContext = $state<ReturnType<typeof getQueryContext>>({ type: 'none' });

	// Display value: localBuffer when focused, externalValue when not
	let displayValue = $derived(focused ? localBuffer : externalValue);

	// Sync externalValue into localBuffer when not focused
	$effect(() => {
		if (!focused) {
			localBuffer = externalValue;
		}
	});

	// Cleanup debounce timer on destroy
	$effect(() => {
		return () => {
			if (valueDebounceTimer) clearTimeout(valueDebounceTimer);
		};
	});

	// --- Autocomplete logic ---

	function updateSuggestions() {
		if (!inputEl) return;
		// Clear any pending value debounce when context changes
		if (valueDebounceTimer) clearTimeout(valueDebounceTimer);
		const cursorPos = inputEl.selectionStart ?? localBuffer.length;
		const ctx = getQueryContext(localBuffer, cursorPos);
		lastContext = ctx;

		if (ctx.type === 'field') {
			const frag = ctx.fragment.toLowerCase();
			suggestions = fields
				.map((f) => f.name)
				.filter((name) => name.toLowerCase().includes(frag))
				.slice(0, 10);
			// Hide if the only suggestion exactly matches what's already typed
			if (suggestions.length === 1 && suggestions[0] === ctx.fragment) {
				suggestions = [];
			}
			showDropdown = suggestions.length > 0;
			selectedIndex = -1;
		} else if (ctx.type === 'value') {
			valueDebounceTimer = setTimeout(async () => {
				try {
					suggestions = await onsearchvalues(ctx.field, ctx.fragment);
				} catch {
					suggestions = [];
				}
				// Hide if the only suggestion exactly matches what's already typed
				if (suggestions.length === 1 && suggestions[0] === ctx.fragment) {
					suggestions = [];
				}
				showDropdown = suggestions.length > 0;
				selectedIndex = -1;
			}, 300);
		} else {
			showDropdown = false;
			suggestions = [];
		}
	}

	// --- Selection logic ---

	async function selectSuggestion(suggestion: string) {
		const ctx = lastContext;
		if (ctx.type === 'none') return;

		let insertion: string;
		let newCursorPos: number;

		if (ctx.type === 'field') {
			insertion = suggestion + ':';
			newCursorPos = ctx.start + insertion.length;
		} else {
			insertion = suggestion;
			newCursorPos = ctx.start + insertion.length;
		}

		localBuffer = localBuffer.slice(0, ctx.start) + insertion + localBuffer.slice(ctx.end);
		showDropdown = false;
		suggestions = [];
		selectedIndex = -1;
		validationError = null;

		await tick();
		inputEl?.setSelectionRange(newCursorPos, newCursorPos);
		inputEl?.focus();
		updateSuggestions();
	}

	// --- Event handlers ---

	function handleInput(e: Event) {
		localBuffer = (e.currentTarget as HTMLInputElement).value;
		validationError = null;
		updateSuggestions();
	}

	function handleFocus() {
		localBuffer = externalValue;
		focused = true;
	}

	function handleBlur() {
		// Validate before unfocusing so error message matches visible content
		const error = validateQuery(localBuffer);
		validationError = error;
		// Delay hiding dropdown and unfocusing to allow click on suggestion items
		setTimeout(() => {
			showDropdown = false;
			focused = false;
		}, 150);
	}

	export function submit() {
		const error = validateQuery(localBuffer);
		if (error) {
			validationError = error;
		} else {
			validationError = null;
			onsubmit(localBuffer);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showDropdown && suggestions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				return;
			}
			if (e.key === 'Tab' && suggestions.length > 0) {
				e.preventDefault();
				const idx = selectedIndex >= 0 ? selectedIndex : 0;
				selectSuggestion(suggestions[idx]);
				return;
			}
			if (e.key === 'Enter' && selectedIndex >= 0) {
				e.preventDefault();
				selectSuggestion(suggestions[selectedIndex]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showDropdown = false;
				selectedIndex = -1;
				return;
			}
		}

		if (e.key === 'Enter') {
			submit();
		}
	}

	function handleSuggestionMousedown(e: MouseEvent, suggestion: string) {
		e.preventDefault(); // Prevent input blur
		selectSuggestion(suggestion);
	}

	// Generate unique IDs for ARIA
	const listboxId = `query-listbox-${Math.random().toString(36).slice(2, 8)}`;
	function optionId(idx: number) {
		return `${listboxId}-option-${idx}`;
	}
</script>

<div class="relative min-w-0 flex-1">
	<input
		bind:this={inputEl}
		type="text"
		class="input-bordered input input-sm w-full min-w-0"
		class:input-error={validationError}
		placeholder="Lucene query (e.g. level:error AND service:api)"
		value={displayValue}
		oninput={handleInput}
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
		role="combobox"
		aria-expanded={showDropdown}
		aria-controls={listboxId}
		aria-activedescendant={selectedIndex >= 0 ? optionId(selectedIndex) : undefined}
		autocomplete="off"
	/>

	{#if showDropdown && suggestions.length > 0}
		<ul
			id={listboxId}
			role="listbox"
			class="absolute top-full left-0 z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 shadow-lg"
		>
			{#if lastContext.type === 'value'}
				<li class="px-3 py-1 text-xs tracking-wide text-base-content/60 uppercase">
					Values for {lastContext.field}
				</li>
			{/if}
			{#each suggestions as suggestion, i (suggestion)}
				<li
					id={optionId(i)}
					role="option"
					aria-selected={i === selectedIndex}
					class="cursor-pointer px-3 py-1.5 text-sm"
					class:bg-base-200={i === selectedIndex}
					onmousedown={(e) => handleSuggestionMousedown(e, suggestion)}
					onmouseenter={() => (selectedIndex = i)}
				>
					{suggestion}
				</li>
			{/each}
		</ul>
	{/if}

	{#if validationError}
		<p class="mt-1 text-xs text-error">{validationError}</p>
	{/if}
</div>
