<script lang="ts">
	import { page } from '$app/state';
	import { navGroups } from '$lib/settings-nav';

	const role = $derived(page.data.session?.user?.role);
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
								class="nav-rail flex items-center gap-2.5 rounded px-3 py-1.5 text-sm transition-colors {active
									? 'text-base-content bg-base-200'
									: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
							>
								<span class="nav-rail-bar"></span>
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
