<script lang="ts">
	import { page } from '$app/state';
	import { navGroups } from '$lib/settings-nav';

	const role = $derived(page.data.session?.user?.role);
	const isAdmin = $derived(role === 'admin');
	const visibleGroups = $derived(navGroups.filter((g) => !g.adminOnly || isAdmin));
	const path = $derived(page.url.pathname);
</script>

<nav
	aria-label="Settings"
	class="border-line relative min-h-0 min-w-0 shrink-0 overflow-auto border-b px-3 py-2 lg:w-48 lg:border-r lg:border-b-0 lg:py-6 xl:w-56"
>
	<div class="flex gap-3 lg:flex-col lg:gap-5">
		{#each visibleGroups as group (group.label)}
			<div class="shrink-0">
				<p class="section-label sr-only px-3 pb-2 lg:not-sr-only">{group.label}</p>
				<ul class="flex gap-0.5 lg:flex-col">
					{#each group.items as item (item.href)}
						{@const active = path === item.href || path.startsWith(item.href + '/')}
						{@const Icon = item.icon}
						<li>
							<a
								href={item.href}
								aria-current={active ? 'page' : undefined}
								class="nav-rail flex min-h-10 items-center gap-2.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors lg:min-h-0 {active
									? 'text-base-content bg-base-200'
									: 'text-muted hover:text-base-content hover:bg-base-200/60'}"
							>
								<span class="nav-rail-bar"></span>
								<Icon class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
								{item.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</nav>
