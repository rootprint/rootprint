<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import SystemFooter from '$lib/components/shell/SystemFooter.svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		document.getElementById('boot-loader')?.classList.add('hidden');
	});
</script>

<div class="bg-base-100 text-base-content flex h-screen flex-col">
	<div class="flex min-h-0 flex-1 flex-col">
		{@render children?.()}
	</div>
	<SystemFooter />
</div>

<Toaster position="bottom-right" closeButton={false} richColors={false} theme="light" />
