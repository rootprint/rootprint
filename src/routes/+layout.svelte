<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/logo.svg';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head>
	<title>Logwiz</title>
	<link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>
<Toaster richColors position="bottom-right" />
{@render children()}
