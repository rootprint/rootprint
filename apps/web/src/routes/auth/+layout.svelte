<script lang="ts">
	let { children } = $props();
</script>

<div class="bg-base-100 text-base-content flex min-h-screen flex-col">
	<header class="px-8 py-6">
		<a href="/" class="font-mono text-sm tracking-wider lowercase">
			<span class="text-primary">/</span>logwiz
		</a>
	</header>

	<main class="flex flex-1 items-center justify-center px-4 pb-16">
		<div class="bg-base-200 hairline w-full max-w-sm rounded-box p-8">
			{@render children?.()}
		</div>
	</main>

	<footer class="text-base-content/40 px-8 py-6 font-mono text-xs">
		<span>open source logging on quickwit</span>
	</footer>
</div>
