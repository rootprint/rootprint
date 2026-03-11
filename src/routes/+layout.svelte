<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head>
	<title>Logwiz</title>
	<link rel="icon" href={favicon} type="image/png" />
</svelte:head>
{@render children()}
