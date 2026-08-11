<script lang="ts">
	import { Copy } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { copyWithToast } from '$lib/utils/clipboard';
	import { pluralize } from '$lib/utils/format';
	import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';

	let { value }: { value: unknown } = $props();

	const text = $derived.by(() => {
		if (typeof value === 'string') return value;
		if (Array.isArray(value)) return value.join('\n');
		if (value != null && typeof value === 'object') return JSON.stringify(value, null, 2);
		return String(value ?? '');
	});
	const lineCount = $derived(text === '' ? 0 : text.split('\n').length);

	function copyTraceback(): void {
		void copyWithToast(text, 'Traceback copied');
	}
</script>

<div class="flex h-full min-h-0 flex-col p-3">
	<div
		class="border-line bg-base-200/50 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border"
	>
		<div class="border-line bg-base-200 flex items-center justify-between border-b px-3 py-1.5">
			<div class="flex items-center gap-2">
				<span class="eyebrow text-[10px]">Traceback</span>
				<span class="text-base-content/40 text-[10px] tabular-nums">
					{pluralize(lineCount, 'line')}
				</span>
			</div>
			<button
				type="button"
				class="btn btn-ghost btn-xs gap-1"
				aria-label="Copy traceback"
				onclick={copyTraceback}
			>
				<Copy class="h-3 w-3" aria-hidden="true" />
				Copy
			</button>
		</div>
		<OverlayScrollbarsComponent
			options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
			defer
			class="min-h-0 flex-1"
		>
			<pre class="p-3 text-xs leading-relaxed whitespace-pre">{text}</pre>
		</OverlayScrollbarsComponent>
	</div>
</div>
