<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="auth-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true"></div>

<div
	class="border-base-300 bg-auth-card relative z-10 m-auto flex min-h-[480px] w-[480px] shrink-0 flex-col justify-center border p-7 [&_.alert]:rounded-none [&_.btn]:rounded-none [&_.input]:rounded-none [&_.select]:rounded-none"
>
	<a
		href="/"
		class="absolute bottom-[calc(100%_+_1rem)] left-0 flex items-center"
		aria-label="Rootprint home"
	>
		<img src="/rootprint-wordmark.png" alt="Rootprint" class="h-7 object-contain" />
	</a>
	{@render children()}
</div>
