<script lang="ts">
	import ActivityPanel from '$lib/components/activity/ActivityPanel.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { setSearchParam } from '$lib/utils/search-params';

	let { data } = $props();
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader>
		{#await data.summary}
			<h1 class="text-h1 text-base-content/40 mt-3">Loading…</h1>
		{:then s}
			<h1 class="text-h1 mt-3">{s.displayName ?? `API key #${data.apiKeyId}`}</h1>
			<p class="text-base-content/60 mt-2 font-mono text-xs">#{data.apiKeyId}</p>
		{:catch}
			<h1 class="text-h1 mt-3">API key #{data.apiKeyId}</h1>
		{/await}
	</PageHeader>

	<div class="mt-8">
		<ActivityPanel
			window={data.window}
			offset={data.offset}
			summary={data.summary}
			volume={data.volume}
			latency={data.latency}
			recent={data.recent}
			onSetParam={setSearchParam}
		/>
	</div>
</div>
