<script lang="ts">
	import SettingsNav from '$lib/components/shell/SettingsNav.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
	<SettingsNav />

	<div class="@container/settings min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
		{@render children()}
	</div>
</div>
