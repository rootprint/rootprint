<script lang="ts">
	import { page } from '$app/state';
	import { crossfade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

	const sections = [
		{ href: '/administration', label: 'Overview' },
		{ href: '/administration/indexes', label: 'Indexes' },
		{ href: '/administration/tokens', label: 'Tokens' },
		{ href: '/administration/users', label: 'Users' },
		{ href: '/administration/authentication', label: 'Authentication' },
		{ href: '/administration/send-logs', label: 'Send logs' }
	];

	const path = $derived(page.url.pathname);
</script>

<nav class="hairline w-56 shrink-0 border-y-0 border-l-0 px-3 py-6">
	<p class="eyebrow px-3 pb-3">Administration</p>
	<ul class="flex flex-col gap-0.5">
		{#each sections as section (section.href)}
			{@const active =
				path === section.href ||
				(section.href !== '/administration' && path.startsWith(section.href + '/'))}
			<li>
				<a
					href={section.href}
					class="relative block rounded px-3 py-1.5 text-sm transition-colors {active
						? 'text-base-content bg-base-200'
						: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
				>
					{#if active}
						<span
							in:receive={{ key: 'admin-nav-indicator' }}
							out:send={{ key: 'admin-nav-indicator' }}
							class="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
						></span>
					{/if}
					{section.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
