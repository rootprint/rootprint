<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { value }: { value: unknown } = $props();

	const text = $derived.by(() => {
		if (typeof value === 'string') return value;
		if (Array.isArray(value)) return value.join('\n');
		if (value != null && typeof value === 'object') return JSON.stringify(value, null, 2);
		return String(value ?? '');
	});
</script>

<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="h-full">
	<div class="p-3">
		<div
			class="border-line rounded-md border p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
		>
			{text}
		</div>
	</div>
</OverlayScrollbarsComponent>
