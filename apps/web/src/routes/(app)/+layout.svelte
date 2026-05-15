<script lang="ts">
	import QuickwitStatusBanner from '$lib/components/ui/QuickwitStatusBanner.svelte';
	import TopBar from '$lib/components/shell/TopBar.svelte';

	let { data, children } = $props();

	const user = $derived(data.session!.user);
</script>

<div class="flex min-h-0 w-full flex-1 flex-col">
	<TopBar
		user={{
			id: user.id,
			name: user.name,
			email: user.email,
			role: (user as { role?: string }).role ?? 'user'
		}}
	/>

	<QuickwitStatusBanner status={undefined} />

	<div class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
