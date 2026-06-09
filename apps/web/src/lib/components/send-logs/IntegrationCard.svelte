<script lang="ts">
	import type { Integration } from '$lib/send-logs/types';

	let { integration }: { integration: Integration } = $props();
	const Icon = $derived(integration.icon);
</script>

<a
	href="/settings/send-logs/{integration.id}"
	class="border-line rounded-box hover:bg-base-200/60 flex w-40 flex-col items-center gap-3 border p-5 text-center transition-colors"
>
	<Icon class="size-8 shrink-0" />
	<span class="text-sm font-medium">{integration.label}</span>
</a>
