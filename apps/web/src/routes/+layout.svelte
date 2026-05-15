<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	let { children } = $props();

	onMount(() => {
		document.getElementById('boot-loader')?.classList.add('hidden');
	});
</script>

{@render children?.()}
