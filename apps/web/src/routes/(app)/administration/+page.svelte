<script lang="ts">
	import { Boxes, Key, Mail, ShieldCheck, Users } from 'lucide-svelte';

	const sections = [
		{
			href: '/administration/indexes',
			icon: Boxes,
			title: 'Indexes',
			desc: 'Manage index lifecycle, schema, fields, and sources.'
		},
		{
			href: '/administration/tokens',
			icon: Key,
			title: 'Ingest tokens',
			desc: 'Create and revoke tokens for sending logs.'
		},
		{
			href: '/administration/users',
			icon: Users,
			title: 'Users',
			desc: 'Invite teammates, set roles, reset passwords.'
		},
		{
			href: '/administration/authentication',
			icon: ShieldCheck,
			title: 'Authentication',
			desc: 'Configure sign-in providers and policies.'
		},
		{
			href: '/administration/send-logs',
			icon: Mail,
			title: 'Send logs',
			desc: 'Per-source guides for getting logs into Logwiz.'
		}
	];
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration</p>
	<h1 class="mt-3 text-h1">Overview</h1>
	<p class="text-base-content/60 mt-3 max-w-2xl text-sm">
		Configure indexes, ingest tokens, users, authentication, and the send-logs setup guides for your
		Logwiz deployment.
	</p>

	<div class="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
		{#each sections as section (section.href)}
			<a
				href={section.href}
				class="hairline rounded-box hover:bg-base-200/60 group flex flex-col gap-3 p-8 transition-colors"
			>
				<section.icon size={20} class="text-base-content/70 group-hover:text-primary transition-colors" />
				<div>
					<p class="text-base">{section.title}</p>
					<p class="text-base-content/60 mt-1 text-sm">{section.desc}</p>
				</div>
			</a>
		{/each}
	</div>
</div>
