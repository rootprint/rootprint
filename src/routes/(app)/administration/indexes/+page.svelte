<script lang="ts">
	import IndexesTab from '$lib/components/index/IndexesTab.svelte';

	let { data } = $props();
</script>

<IndexesTab indexes={data.indexes} />
