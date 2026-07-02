<script lang="ts">
	import AppSidebar from '$lib/components/shell/AppSidebar.svelte';

	let { data, children } = $props();

	const user = $derived(data.session!.user);
</script>

<div class="flex min-h-0 w-full flex-1">
	<AppSidebar user={{ id: user.id, name: user.name, email: user.email }} />

	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
