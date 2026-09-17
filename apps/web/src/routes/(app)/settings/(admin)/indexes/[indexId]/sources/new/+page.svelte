<script lang="ts">
	import CreateSourceForm from '$lib/components/admin/indexes/CreateSourceForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();
	const detail = $derived(data.detail);
</script>

<div class="settings-page flex flex-col gap-6">
	<PageHeader
		title="Create source"
		description={`Add a new source to ${detail.displayName ?? detail.indexId}.`}
	/>

	<CreateSourceForm {detail} />
</div>
