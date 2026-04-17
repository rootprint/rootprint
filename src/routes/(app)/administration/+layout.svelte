<script lang="ts">
	import AdminBreadcrumbs from '$lib/components/admin/AdminBreadcrumbs.svelte';
	import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';

	let { children } = $props();
</script>

<div class="flex h-full min-h-0">
	<AdminSidebar />
	<div class="min-w-0 flex-1 overflow-y-auto">
		<div class="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
			<AdminBreadcrumbs />
			{@render children()}
		</div>
	</div>
</div>
