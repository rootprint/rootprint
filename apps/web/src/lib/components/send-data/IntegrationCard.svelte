<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import type { Integration, Signal } from '#lib/components/send-data/types.js';

	let { integration, signal }: { integration: Integration; signal: Signal } = $props();
	const Icon = $derived(integration.icon);
	const href = $derived(
		`/send-data/${integration.id}${signal === 'traces' ? '?signal=traces' : ''}`
	);
</script>

<a
	{href}
	class="border-line rounded-box hover:bg-base-200/60 flex items-center gap-3 border px-4 py-3 text-sm transition-colors"
>
	<Icon class="size-6 shrink-0" aria-hidden="true" />
	<span class="min-w-0 truncate" title={integration.label}>{integration.label}</span>
	<ChevronRight class="text-subtle ml-auto size-3.5 shrink-0" aria-hidden="true" />
</a>
