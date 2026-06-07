<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/state';
	import { resolveTitle } from '$lib/page-title';
	import MobileGate from '$lib/components/MobileGate.svelte';
	import '../app.css';

	let { children } = $props();

	const title = $derived(resolveTitle(page.route.id, page.params));

	onMount(() => {
		document.getElementById('boot-loader')?.classList.add('hidden');
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="bg-base-100 text-base-content flex h-screen flex-col">
	<div class="flex min-h-0 flex-1 flex-col">
		{@render children?.()}
	</div>
</div>

<MobileGate />

<Toaster position="bottom-right" closeButton={false} richColors theme="light" />
