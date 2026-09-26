<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Named "settings" because `.settings-page` padding in app.css queries this container. -->
<div class="@container/settings min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
	{@render children()}
</div>
