<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import SettingsNav from '$lib/components/shell/SettingsNav.svelte';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { children } = $props();
</script>

<div class="flex min-h-0 flex-1">
	<SettingsNav />

	<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="min-w-0 flex-1">
		{@render children()}
	</OverlayScrollbarsComponent>
</div>
