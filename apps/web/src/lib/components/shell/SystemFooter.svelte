<script lang="ts">
	const GITHUB = 'https://github.com/oleksandr-zhyhalo/logwiz';
	const DOCS = 'https://docs.logwiz.io';
	const RELEASES = `${GITHUB}/releases`;
</script>

<footer
	class="hairline text-base-content/60 flex items-center justify-between border-x-0 border-b-0 px-8 py-3 font-mono text-xs"
>
	<span>Apache-2.0</span>
	<nav class="flex gap-4">
		<a href={GITHUB} target="_blank" rel="noopener" class="hover:text-base-content">github</a>
		<span class="text-base-content/30">·</span>
		<a href={DOCS} target="_blank" rel="noopener" class="hover:text-base-content">docs</a>
		<span class="text-base-content/30">·</span>
		<a href={RELEASES} target="_blank" rel="noopener" class="hover:text-base-content">releases</a>
	</nav>
</footer>
