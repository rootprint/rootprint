<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-base-100">
	{@render children?.()}
</div>
