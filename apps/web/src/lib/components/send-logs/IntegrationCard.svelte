<script lang="ts">
	import type { Integration } from '$lib/send-logs/types';

	let { integration }: { integration: Integration } = $props();
	const Icon = $derived(integration.icon);
</script>

<a
	href="/settings/send-logs/{integration.id}"
	class="border-line rounded-box hover:bg-base-200/60 group flex items-center gap-3 border p-5 transition-colors"
>
	<Icon class="size-6 shrink-0" />
	<span>{integration.label}</span>
</a>
