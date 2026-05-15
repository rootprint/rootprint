<script lang="ts">
	import { browser } from '$app/environment';
	import type { ComponentStatus, SystemInfo } from 'api/types';

	import { formatElapsed } from '$lib/uptime';
	import StatusDot from './StatusDot.svelte';

	type Props = {
		system: SystemInfo | null;
	};

	let { system }: Props = $props();

	const host = $derived(browser ? window.location.host : '');

	let uptime = $state<string>('—');

	$effect(() => {
		if (!system) {
			uptime = '—';
			return;
		}
		const startMs = new Date(system.startedAt).getTime();
		const tick = () => {
			uptime = formatElapsed((Date.now() - startMs) / 1000);
		};
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	});

	const shortCommit = $derived(system ? system.build.commit.slice(0, 7) : '—');
	const builtDate = $derived(system ? system.build.builtAt.slice(0, 10) : '—');

	const healthRows = $derived<Array<[string, ComponentStatus | 'unknown']>>([
		['api', system?.components.api ?? 'unknown'],
		['postgres', system?.components.postgres ?? 'unknown'],
		['quickwit', system?.components.quickwit ?? 'unknown'],
	]);
</script>

<aside
	class="hairline bg-base-200 hidden w-80 shrink-0 border-y-0 border-l-0 md:flex md:flex-col"
	aria-label="System information"
>
	<div class="px-8 py-6">
		<a href="/" class="font-mono text-sm tracking-wider lowercase">
			<span class="text-primary">/</span>logwiz · console
		</a>
	</div>

	<div class="flex-1 space-y-8 px-8 pb-8 font-mono text-sm">
		<section>
			<p class="eyebrow mb-3">Instance</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
				<dt class="text-base-content/50">url</dt>
				<dd class="truncate">{host}</dd>
				<dt class="text-base-content/50">mode</dt>
				<dd>{system?.mode ?? '—'}</dd>
			</dl>
		</section>

		<section>
			<p class="eyebrow mb-3">Build</p>
			<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
				<dt class="text-base-content/50">version</dt>
				<dd>{system ? `v${system.build.version}` : '—'}</dd>
				<dt class="text-base-content/50">commit</dt>
				<dd>{shortCommit}</dd>
				<dt class="text-base-content/50">built</dt>
				<dd>{builtDate}</dd>
			</dl>
		</section>

		<section>
			<p class="eyebrow mb-3">Health</p>
			<dl class="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-1">
				{#each healthRows as [key, status] (key)}
					<dt class="text-base-content/50">{key}</dt>
					<dd class="flex items-center gap-2">
						<StatusDot {status} />
						<span>{status}</span>
					</dd>
				{/each}
				<dt class="text-base-content/50">uptime</dt>
				<dd>{uptime}</dd>
			</dl>
		</section>
	</div>

	<p class="eyebrow px-8 pb-6">// open source logging</p>
</aside>
