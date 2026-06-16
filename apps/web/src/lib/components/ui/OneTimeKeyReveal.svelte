<script lang="ts">
	import CopyableField from '$lib/components/ui/CopyableField.svelte';

	let { value, ariaLabel }: { value: string; ariaLabel: string } = $props();
</script>

<div class="flex flex-col gap-3">
	<CopyableField {value} {ariaLabel} />
	<p class="text-base-content/60 text-xs">
		This key is shown only once. Copy it now — you won't be able to see it again.
	</p>
</div>
