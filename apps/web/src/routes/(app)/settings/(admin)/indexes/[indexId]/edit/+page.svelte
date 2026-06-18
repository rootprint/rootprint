<script lang="ts">
	import EditIndexForm from '$lib/components/admin/indexes/EditIndexForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 md:px-12">
	<PageHeader
		title="Edit index"
		description="Update the Quickwit configuration for {data.detail.indexId}."
	/>
	{#key data.detail.indexId}
		<EditIndexForm detail={data.detail} />
	{/key}
</div>
