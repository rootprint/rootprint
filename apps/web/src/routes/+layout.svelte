<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/state';
	import { resolveTitle } from '$lib/page-title';
	import MobileGate from '$lib/components/shell/MobileGate.svelte';
	import '../app.css';

	let { children } = $props();

	const title = $derived(resolveTitle(page.route.id, page.params));
	const desktop = new MediaQuery('(min-width: 48rem)');

	onMount(() => {
		document.getElementById('boot-loader')?.classList.add('hidden');
	});
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="bg-base-100 text-base-content flex h-dvh flex-col">
	{#if desktop.current}
		<div class="flex min-h-0 flex-1 flex-col">
			{@render children?.()}
		</div>
		<Toaster position="bottom-right" closeButton={false} richColors theme="light" />
	{:else}
		<MobileGate />
	{/if}
</div>
