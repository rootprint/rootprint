<script lang="ts">
	import CreateIndexForm from '$lib/components/admin/indexes/CreateIndexForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-12 py-12">
	<PageHeader
		title="Create index"
		description="Define a new Quickwit index and its field mappings."
	/>
	<CreateIndexForm />
</div>
