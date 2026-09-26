<script lang="ts">
	import SettingsNav from '$lib/components/shell/SettingsNav.svelte';
	import PageScroll from '$lib/components/ui/PageScroll.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
	<SettingsNav />

	<PageScroll>
		{@render children()}
	</PageScroll>
</div>
