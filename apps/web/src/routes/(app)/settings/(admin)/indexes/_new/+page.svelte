<script lang="ts">
	import CreateIndexForm from '$lib/components/admin/indexes/CreateIndexForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
</script>

<div class="settings-page flex flex-col gap-6">
	<PageHeader
		title="Create index"
		description="Define a new Quickwit index and its field mappings."
	/>
	<CreateIndexForm />
</div>
