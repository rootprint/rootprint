<script lang="ts">
	import TokensManagement from '$lib/components/admin/TokensManagement.svelte';

	let { data } = $props();
</script>

<TokensManagement tokens={data.tokens} indexIds={data.indexIds} />
