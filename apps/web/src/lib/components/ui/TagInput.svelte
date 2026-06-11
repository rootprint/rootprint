<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		tags = $bindable(),
		input = $bindable(''),
		placeholderEmpty,
		placeholderMore = 'Add another…',
		addLabel,
		normalize,
		validate,
		duplicateMessage,
		error = false,
		onError
	}: {
		tags: string[];
		input?: string;
		placeholderEmpty: string;
		placeholderMore?: string;
		addLabel: string;
		normalize?: (raw: string) => string;
		validate?: (value: string) => string | null;
		/** When set, adding a duplicate reports this error; when unset, duplicates are silently ignored. */
		duplicateMessage?: string;
		error?: boolean;
		onError?: (message: string | null) => void;
	} = $props();

	function add() {
		const raw = input.trim();
		if (!raw) return;
		const value = normalize ? normalize(raw) : raw;
		const invalid = validate?.(value);
		if (invalid) {
			onError?.(invalid);
			return;
		}
		if (tags.includes(value)) {
			if (duplicateMessage) {
				onError?.(duplicateMessage);
				return;
			}
			input = '';
			return;
		}
		tags = [...tags, value];
		input = '';
		onError?.(null);
	}

	function remove(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			add();
		} else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div
	class="border-line focus-within:border-base-content bg-base-100 rounded-box flex flex-wrap items-center gap-1.5 border px-2 py-1.5 transition-colors"
	class:!border-error={error}
>
	{#each tags as tag (tag)}
		<span class="bg-base-200 flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs">
			{tag}
			<button
				type="button"
				class="cursor-pointer opacity-50 hover:opacity-100"
				aria-label="Remove {tag}"
				onclick={() => remove(tag)}
			>
				<X class="h-3 w-3" />
			</button>
		</span>
	{/each}
	<input
		bind:value={input}
		placeholder={tags.length === 0 ? placeholderEmpty : placeholderMore}
		autocomplete="off"
		aria-label={addLabel}
		class="placeholder:text-base-content/40 min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
		onkeydown={handleKeydown}
	/>
</div>
