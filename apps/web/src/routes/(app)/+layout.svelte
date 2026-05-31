<script lang="ts">
	import QuickwitStatusBanner from '$lib/components/ui/QuickwitStatusBanner.svelte';
	import AppSidebar from '$lib/components/shell/AppSidebar.svelte';

	let { data, children } = $props();

	const user = $derived(data.session!.user);
</script>

<div class="flex min-h-0 w-full flex-1">
	<AppSidebar
		user={{
			id: user.id,
			name: user.name,
			email: user.email,
			role: (user as { role?: string }).role ?? 'user'
		}}
	/>

	<div class="flex min-w-0 flex-1 flex-col">
		<QuickwitStatusBanner status={undefined} />

		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
	</div>
</div>
