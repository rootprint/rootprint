<script lang="ts">
	import { page } from '$app/state';
	import UserMenu from './UserMenu.svelte';

	type User = { id: string; name: string | null; email: string; role: string };

	let { user }: { user: User } = $props();

	const isAdmin = $derived(user.role === 'admin');
	const path = $derived(page.url.pathname);
	const onLogs = $derived(path === '/' || (!path.startsWith('/administration') && !path.startsWith('/auth')));
	const onAdmin = $derived(path.startsWith('/administration'));
</script>

<header class="hairline bg-base-100 flex h-12 items-center gap-6 border-x-0 border-t-0 px-4">
	<a href="/" class="font-mono text-sm tracking-wider lowercase hover:opacity-80">
		<span class="text-primary">/</span>logwiz
	</a>

	<nav class="flex h-full items-center gap-1">
		<a
			href="/"
			class="relative flex h-full items-center px-3 text-sm transition-colors {onLogs
				? 'text-base-content'
				: 'text-base-content/60'}"
		>
			Logs
			<span
				class="bg-primary absolute right-3 bottom-0 left-3 h-px transition-opacity"
				class:opacity-0={!onLogs}
				class:opacity-100={onLogs}
			></span>
		</a>
		{#if isAdmin}
			<a
				href="/administration"
				class="relative flex h-full items-center px-3 text-sm transition-colors {onAdmin
					? 'text-base-content'
					: 'text-base-content/60'}"
			>
				Administration
				<span
					class="bg-primary absolute right-3 bottom-0 left-3 h-px transition-opacity"
					class:opacity-0={!onAdmin}
					class:opacity-100={onAdmin}
				></span>
			</a>
		{/if}
	</nav>

	<div class="flex-1"></div>

	<UserMenu {user} />
</header>
