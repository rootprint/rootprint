<script lang="ts">
	import { page } from '$app/state';

	const LABELS: Record<string, string> = {
		administration: 'Administration',
		'send-logs': 'Send Logs',
		tokens: 'Tokens',
		indexes: 'Indexes',
		users: 'Users',
		authentication: 'Authentication',
		google: 'Google',
		python: 'Python',
		javascript: 'Node.js',
		go: 'Go',
		java: 'Java',
		dotnet: '.NET',
		http: 'HTTP',
		docker: 'Docker'
	};

	const crumbs = $derived.by(() => {
		const segments = page.url.pathname.split('/').filter(Boolean);
		if (segments[0] !== 'administration') return [];
		const list: { href: string; label: string }[] = [];
		let href = '';
		for (const segment of segments) {
			href += `/${segment}`;
			list.push({ href, label: LABELS[segment] ?? segment });
		}
		return list;
	});
</script>

{#if crumbs.length > 0}
	<nav aria-label="Breadcrumb" class="text-sm">
		<ol class="flex items-center gap-1.5">
			{#each crumbs as crumb, index (crumb.href)}
				{@const isLast = index === crumbs.length - 1}
				<li class="flex items-center gap-1.5">
					{#if index > 0}
						<span aria-hidden="true" class="text-base-content/40">›</span>
					{/if}
					{#if isLast}
						<span class="font-medium text-base-content" aria-current="page">
							{crumb.label}
						</span>
					{:else}
						<a href={crumb.href} class="text-base-content/70 underline hover:text-base-content">
							{crumb.label}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
{/if}
