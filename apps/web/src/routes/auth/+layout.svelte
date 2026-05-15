<script lang="ts">
	import AuthShell from '$lib/components/auth-shell/AuthShell.svelte';

	let { data, children } = $props();
</script>

<AuthShell system={data.system}>
	{@render children?.()}
</AuthShell>
