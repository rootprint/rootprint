<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Named "settings" because `.settings-page` padding in app.css queries this container.
     `relative` makes it the containing block for absolute descendants (CopyButton's sr-only live
     region): without it they resolve against the document at their deep scroll offset and stretch
     the window, so the whole shell scrolls past the page. -->
<div class="@container/settings relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
	{@render children()}
</div>
