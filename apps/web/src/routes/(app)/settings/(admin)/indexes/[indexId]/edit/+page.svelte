<script lang="ts">
	import EditIndexForm from '$lib/components/admin/indexes/EditIndexForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();
</script>

<div class="settings-page flex flex-col gap-6">
	<PageHeader
		title="Edit index"
		description="Update the Quickwit configuration for {data.detail.indexId}."
	/>
	{#key data.detail.indexId}
		<EditIndexForm detail={data.detail} />
	{/key}
</div>
