<script lang="ts">
	import IngestTokensCard from '$lib/components/admin/IngestTokensCard.svelte';
	import IngestTokensList from '$lib/components/admin/IngestTokensList.svelte';
	import type { IngestTokenSummary } from '$lib/types';

	let {
		ingestTokens,
		ingestIndexIds
	}: {
		ingestTokens: IngestTokenSummary[];
		ingestIndexIds: string[];
	} = $props();
</script>

<div class="flex flex-col gap-6">
	<IngestTokensCard indexIds={ingestIndexIds} />
	<IngestTokensList tokens={ingestTokens} />
</div>
