<script lang="ts">
	import CopyableField from '$lib/components/ui/CopyableField.svelte';

	let { value }: { value: string } = $props();
</script>

<div class="flex flex-col gap-3">
	<CopyableField {value} ariaLabel="Ingest token" />
</div>
