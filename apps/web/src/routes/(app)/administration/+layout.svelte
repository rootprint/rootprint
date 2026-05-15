<script lang="ts">
	import AdminNav from '$lib/components/shell/AdminNav.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-0 flex-1">
	<AdminNav />

	<div class="min-w-0 flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
