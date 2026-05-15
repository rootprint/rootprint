<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		document.getElementById('boot-loader')?.classList.add('hidden');
	});
</script>

{@render children?.()}

<Toaster position="bottom-right" closeButton={false} richColors={false} theme="light" />
