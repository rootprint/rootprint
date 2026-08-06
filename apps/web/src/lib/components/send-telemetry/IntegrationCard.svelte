<script lang="ts">
	import type { Integration, Signal } from '$lib/send-telemetry/types';

	let { integration, signal }: { integration: Integration; signal: Signal } = $props();
	const Icon = $derived(integration.icon);
	const href = $derived(
		`/settings/send-telemetry/${integration.id}${signal === 'traces' ? '?signal=traces' : ''}`
	);
</script>

<a
	{href}
	class="border-line rounded-box hover:bg-base-200/60 flex w-40 flex-col items-center gap-3 border p-5 text-center transition-colors"
>
	<Icon class="size-8 shrink-0" />
	<span class="text-sm font-medium">{integration.label}</span>
</a>
