<script lang="ts">
	import SendLogsTab from '$lib/components/admin/SendLogsTab.svelte';

	let { data } = $props();
</script>

<SendLogsTab
	origin={data.origin}
	ingestTokens={data.ingestTokens}
	ingestIndexIds={data.ingestIndexIds}
/>
