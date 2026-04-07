<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { tick } from 'svelte';
	import getCaretCoordinates from 'textarea-caret';

	import type { IndexField } from '$lib/types';
	import { useDebounce } from '$lib/utils/debounce';
	import { getQueryContext, validateQuery } from '$lib/utils/lucene';

	interface Props {
		externalValue: string;
		fields: IndexField[];
		autocomplete?: boolean;
		onsubmit: (query: string) => void;
		onsearchvalues: (field: string, searchTerm: string) => Promise<string[]>;
	}

	let { externalValue, fields, autocomplete = true, onsubmit, onsearchvalues }: Props = $props();

	// --- Internal state (owns the localBuffer pattern from +page.svelte) ---
	let localBuffer = $state('');
	let focused = $state(false);
	let showDropdown = $state(false);
	let suggestions = $state<string[]>([]);
	let selectedIndex = $state(-1);
	let validationError = $state<string | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let lastContext = $state<ReturnType<typeof getQueryContext>>({ type: 'none' });

	let dropdownLeft = $derived.by(() => {
		if (!inputEl || lastContext.type === 'none') return 0;
		const { left } = getCaretCoordinates(inputEl, lastContext.start);
		const adjustedLeft = left - inputEl.scrollLeft;
		const inputWidth = inputEl.offsetWidth;
		const dropdownWidth = 256;
		return Math.max(0, Math.min(adjustedLeft, inputWidth - dropdownWidth));
	});

	const { debounced: debouncedValueSearch, cleanup: cleanupDebounce } = useDebounce(
		async (field: string, fragment: string) => {
			try {
				suggestions = await onsearchvalues(field, fragment);
			} catch {
				suggestions = [];
			}
			if (suggestions.length === 1 && suggestions[0] === fragment) {
				suggestions = [];
			}
			showDropdown = suggestions.length > 0;
			selectedIndex = -1;
		},
		300
	);

	$effect(() => {
		return () => cleanupDebounce();
	});

	$effect(() => {
		if (!autocomplete) {
			cleanupDebounce();
			showDropdown = false;
			suggestions = [];
		}
	});

	// Display value: localBuffer when focused, externalValue when not
	let displayValue = $derived(focused ? localBuffer : externalValue);

	// Sync externalValue into localBuffer when not focused
	$effect(() => {
		if (!focused) {
			localBuffer = externalValue;
		}
	});

	// --- Autocomplete logic ---

	function updateSuggestions() {
		if (!inputEl || !autocomplete) {
			showDropdown = false;
			suggestions = [];
			return;
		}
		// Clear any pending value debounce when context changes
		cleanupDebounce();
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
			debouncedValueSearch(ctx.field, ctx.fragment);
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
		updateSuggestions();
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

	export function getValue() {
		return localBuffer;
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
				document.getElementById(optionId(selectedIndex))?.scrollIntoView({ block: 'nearest' });
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				if (selectedIndex >= 0) {
					document.getElementById(optionId(selectedIndex))?.scrollIntoView({ block: 'nearest' });
				}
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
		<div
			class="absolute top-full z-50 mt-1 max-h-64 w-64 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-lg"
			style:left="{dropdownLeft}px"
		>
			<OverlayScrollbarsComponent
				options={{
					scrollbars: { theme: 'os-theme-dark', autoHide: 'leave', autoHideDelay: 400 },
					overflow: { x: 'hidden' }
				}}
				defer
				class="max-h-64"
			>
				<ul id={listboxId} role="listbox">
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
			</OverlayScrollbarsComponent>
		</div>
	{/if}

	{#if validationError}
		<p class="mt-1 text-xs text-error">{validationError}</p>
	{/if}
</div>
