<script lang="ts">
	import SecretReveal from '$lib/components/ui/SecretReveal.svelte';

	let { value, label }: { value: string; label: string } = $props();
</script>

<div class="flex flex-col gap-3">
	<SecretReveal {value} {label} />
	<p class="text-base-content/60 text-xs">
		This key is shown only once. Copy it now — you won't be able to see it again.
	</p>
</div>
