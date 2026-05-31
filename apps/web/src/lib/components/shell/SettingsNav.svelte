<script lang="ts">
	import { page } from '$app/state';
	import { crossfade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { navGroups } from '$lib/settings-nav';

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

	const role = $derived((page.data.session?.user as { role?: string } | undefined)?.role);
	const isAdmin = $derived(role === 'admin');
	const visibleGroups = $derived(navGroups.filter((g) => !g.adminOnly || isAdmin));
	const path = $derived(page.url.pathname);
</script>

<nav aria-label="Settings" class="border-line w-56 shrink-0 border-r px-3 py-6">
	<div class="flex flex-col gap-5">
		{#each visibleGroups as group (group.label)}
			<div>
				<p class="eyebrow px-3 pb-2">{group.label}</p>
				<ul class="flex flex-col gap-0.5">
					{#each group.items as item (item.href)}
						{@const active = path === item.href || path.startsWith(item.href + '/')}
						{@const Icon = item.icon}
						<li>
							<a
								href={item.href}
								aria-current={active ? 'page' : undefined}
								class="relative flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors {active
									? 'text-base-content bg-base-200'
									: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
							>
								{#if active}
									<span
										in:receive={{ key: 'settings-nav-indicator' }}
										out:send={{ key: 'settings-nav-indicator' }}
										class="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
									></span>
								{/if}
								<Icon class="h-4 w-4 shrink-0 opacity-70" />
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</nav>
