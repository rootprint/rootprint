<script lang="ts">
	import { Database, Key, Shield, Upload, Users } from 'lucide-svelte';

	import { page } from '$app/state';

	const sections = [
		{ href: '/administration/send-logs', label: 'Send Logs', icon: Upload },
		{ href: '/administration/tokens', label: 'Tokens', icon: Key },
		{ href: '/administration/indexes', label: 'Indexes', icon: Database },
		{ href: '/administration/users', label: 'Users', icon: Users },
		{ href: '/administration/authentication', label: 'Authentication', icon: Shield }
	] as const;

	const pathname = $derived(page.url.pathname);

	function isActive(href: string) {
		return pathname === href || pathname.startsWith(`${href}/`);
	}
</script>

<aside
	class="flex w-60 shrink-0 flex-col border-r border-base-300 bg-base-200/40 px-3 py-4"
	aria-label="Administration navigation"
>
	<div class="mb-3 px-3 text-xs font-semibold tracking-wide text-base-content/60 uppercase">
		Administration
	</div>
	<nav class="flex flex-col gap-1">
		{#each sections as section (section.href)}
			{@const Icon = section.icon}
			{@const active = isActive(section.href)}
			<a
				href={section.href}
				class="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors {active
					? 'bg-base-300 font-medium text-base-content'
					: 'text-base-content/80 hover:bg-base-200'}"
				aria-current={active ? 'page' : undefined}
			>
				<Icon size={16} class="opacity-70" />
				{section.label}
			</a>
		{/each}
	</nav>
</aside>
