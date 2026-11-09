<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		tags = $bindable(),
		pending = $bindable(''),
		placeholderEmpty,
		addLabel,
		normalize,
		validate,
		duplicateMessage,
		error = false,
		onError
	}: {
		tags: string[];
		/** Typed text not yet added; after a blur, anything left here failed `validate` or was a reported duplicate. */
		pending?: string;
		placeholderEmpty: string;
		addLabel: string;
		normalize?: (raw: string) => string;
		validate?: (value: string) => string | null;
		/** When set, adding a duplicate reports this error; when unset, duplicates are silently ignored. */
		duplicateMessage?: string;
		error?: boolean;
		onError?: (message: string | null) => void;
	} = $props();

	function add() {
		const raw = pending.trim();
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
			onError?.(null);
			pending = '';
			return;
		}
		tags = [...tags, value];
		pending = '';
		onError?.(null);
	}

	function remove(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			add();
		} else if (e.key === 'Backspace' && pending === '' && tags.length > 0) {
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
				class="text-subtle hover:text-base-content cursor-pointer"
				aria-label="Remove {tag}"
				title="Remove {tag}"
				onclick={() => remove(tag)}
			>
				<X class="size-3" aria-hidden="true" />
			</button>
		</span>
	{/each}
	<input
		bind:value={pending}
		placeholder={tags.length === 0 ? placeholderEmpty : 'Add another…'}
		autocomplete="off"
		aria-label={addLabel}
		class="placeholder:text-subtle min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
		onkeydown={handleKeydown}
		onblur={add}
	/>
</div>
