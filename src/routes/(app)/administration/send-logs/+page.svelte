<script lang="ts">
	import dockerIcon from '@iconify-icons/logos/docker-icon';
	import goIcon from '@iconify-icons/logos/go';
	import nginxIcon from '@iconify-icons/logos/nginx';
	import nodejsIcon from '@iconify-icons/logos/nodejs-icon';
	import pythonIcon from '@iconify-icons/logos/python';
	import vectorTimberIcon from '@iconify-icons/logos/vector-timber';
	import webIcon from '@iconify-icons/mdi/web';

	import caddyLogo from '$lib/assets/caddy-logo.png';
	import fluentBitLogo from '$lib/assets/fluent-bit-logo.png';
	import SendLogsSourceCard from '$lib/components/admin/SendLogsSourceCard.svelte';

	const sections = [
		{
			label: 'Languages',
			sources: [
				{ label: 'Python', icon: pythonIcon, href: '/administration/send-logs/python' },
				{ label: 'Node.js', icon: nodejsIcon, href: '/administration/send-logs/javascript' },
				{ label: 'Go', icon: goIcon, href: '/administration/send-logs/go' }
			]
		},
		{
			label: 'Platforms',
			sources: [{ label: 'Docker', icon: dockerIcon, href: '/administration/send-logs/docker' }]
		},
		{
			label: 'Web Servers',
			sources: [
				{ label: 'Caddy', iconSrc: caddyLogo, href: '/administration/send-logs/caddy' },
				{ label: 'Nginx', icon: nginxIcon, href: '/administration/send-logs/nginx' }
			]
		},
		{
			label: 'Log Agents',
			sources: [
				{
					label: 'Fluent Bit',
					iconSrc: fluentBitLogo,
					href: '/administration/send-logs/fluent-bit'
				},
				{ label: 'Vector', icon: vectorTimberIcon, href: '/administration/send-logs/vector' }
			]
		},
		{
			label: 'Other',
			sources: [{ label: 'HTTP', icon: webIcon, href: '/administration/send-logs/http' }]
		}
	];
</script>

<div class="flex flex-col gap-6">
	<header class="border-b border-base-300 pb-4">
		<h2 class="text-xl font-semibold">Send Logs</h2>
		<p class="mt-1 text-sm text-base-content/60">
			Pick a source to see step-by-step setup instructions.
		</p>
	</header>

	{#each sections as section (section.label)}
		<section class="flex flex-col gap-3">
			<h3 class="text-sm font-semibold text-base-content/70">{section.label}</h3>
			<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
				{#each section.sources as source (source.href)}
					<SendLogsSourceCard {...source} />
				{/each}
			</div>
		</section>
	{/each}
</div>
