<script lang="ts">
	import { Search } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	import SendLogsStep from './SendLogsStep.svelte';

	let {
		number,
		indexId = DEFAULT_OTEL_LOGS_INDEX_ID,
		children
	}: {
		number: number;
		indexId?: string;
		children: Snippet;
	} = $props();
</script>

<SendLogsStep {number} isLast>
	<div>
		<h3 class="font-semibold">Verify in Logwiz</h3>
		<p class="mt-1 text-sm text-base-content/60">
			{@render children()}
		</p>
	</div>
	<div>
		<a href="/?index={encodeURIComponent(indexId)}" class="btn gap-2 btn-sm btn-accent">
			<Search size={14} />
			Open Search
		</a>
	</div>
</SendLogsStep>
