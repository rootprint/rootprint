<script lang="ts">
	import { CircleHelp, BookOpen, GitBranch, Tag } from 'lucide-svelte';

	let { collapsed = false }: { collapsed?: boolean } = $props();

	const GITHUB = 'https://github.com/rootprint/rootprint';
	const DOCS = 'https://docs.rootprint.io';
	const CHANGELOG = `${GITHUB}/blob/main/CHANGELOG.md`;

	const links = [
		{ href: DOCS, label: 'Documentation', icon: BookOpen },
		{ href: GITHUB, label: 'GitHub', icon: GitBranch },
		{ href: CHANGELOG, label: 'Changelog', icon: Tag }
	];
</script>

<div class="dropdown dropdown-right dropdown-end w-full">
	<div
		tabindex="0"
		role="button"
		aria-label="Help"
		data-tip={collapsed ? 'Help' : undefined}
		class="text-base-content/60 hover:text-base-content hover:bg-base-200/60 flex items-center rounded text-sm transition-colors {collapsed
			? 'tooltip tooltip-right h-10 w-10 justify-center'
			: 'h-9 gap-2.5 px-3'}"
	>
		<CircleHelp class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
		{#if !collapsed}
			Help
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<ul
		tabindex="0"
		class="dropdown-content border-line rounded-box bg-base-100 z-50 ml-2 w-52 border p-2"
	>
		{#each links as link (link.href)}
			{@const Icon = link.icon}
			<li>
				<a
					href={link.href}
					target="_blank"
					rel="noopener"
					class="text-base-content/80 hover:text-base-content hover:bg-base-200/60 flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors"
				>
					<Icon class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
					{link.label}
				</a>
			</li>
		{/each}
	</ul>
</div>
