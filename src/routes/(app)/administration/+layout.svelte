<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const sections = [
		{ href: '/administration/send-logs', label: 'Send Logs' },
		{ href: '/administration/indexes', label: 'Indexes' },
		{ href: '/administration/users', label: 'Users' },
		{ href: '/administration/authentication', label: 'Authentication' }
	] as const;

	const pathname = $derived(page.url.pathname);

	function isActive(href: (typeof sections)[number]['href']) {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<div class="h-full overflow-y-auto align-middle">
	<div class="mx-auto max-w-6xl px-4 py-8">
		<div class="flex items-center justify-between py-4">
			<div>
				<h2 class="text-xl font-semibold">Administration</h2>
				<p class="text-sm text-base-content/60">Manage your Logwiz instance configuration</p>
			</div>
		</div>

		<div role="tablist" class="tabs-border tabs mb-6">
			{#each sections as section (section.href)}
				<a
					href={section.href}
					role="tab"
					class="tab"
					class:tab-active={isActive(section.href)}
				>
					{section.label}
				</a>
			{/each}
		</div>

		{@render children()}
	</div>
</div>
