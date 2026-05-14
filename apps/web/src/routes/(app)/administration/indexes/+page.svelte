<script lang="ts">
	import IndexList from '$lib/components/index/IndexList.svelte';

	let { data } = $props();
</script>

<IndexList indexes={data.indexes} />
