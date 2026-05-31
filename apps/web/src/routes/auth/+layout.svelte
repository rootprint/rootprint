<script lang="ts">
	import AuthBackdrop from '$lib/components/auth/AuthBackdrop.svelte';

	let { children } = $props();
</script>

<main class="flex flex-1 overflow-auto px-4 py-8">
	<AuthBackdrop>
		{@render children?.()}
	</AuthBackdrop>
</main>
