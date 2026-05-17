<script lang="ts">
	let { children } = $props();
</script>

<main class="flex flex-1 items-center justify-center px-4 py-16">
	<div class="w-full max-w-sm">
		{@render children?.()}
	</div>
</main>
