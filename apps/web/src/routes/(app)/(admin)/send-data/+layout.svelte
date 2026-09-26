<script lang="ts">
	import PageScroll from '$lib/components/ui/PageScroll.svelte';

	let { children } = $props();
</script>

<PageScroll>
	{@render children()}
</PageScroll>
