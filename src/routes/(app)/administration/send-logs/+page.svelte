<script lang="ts">
	import SendLogsTab from '$lib/components/admin/SendLogsTab.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-6">
	<header>
		<h2 class="text-xl font-semibold">Send Logs</h2>
		<p class="mt-1 text-sm text-base-content/60">
			Configuration and examples for ingesting logs into Logwiz.
		</p>
	</header>

	<SendLogsTab origin={data.origin} />
</div>
