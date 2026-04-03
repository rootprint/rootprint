<script lang="ts">
	import './layout.css';

	import { Toaster } from 'svelte-sonner';

	import favicon from '$lib/assets/logo.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>Logwiz</title>
	<link rel="icon" href={favicon} type="image/svg+xml" />
</svelte:head>
<Toaster richColors position="bottom-right" />
{@render children()}
