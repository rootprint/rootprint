<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { SystemInfo } from 'api/types';

	import StatusDot from './StatusDot.svelte';
	import SystemRail from './SystemRail.svelte';

	type RollupStatus = 'ok' | 'degraded' | 'down';

	const ROLLUP_LABEL: Record<RollupStatus, string> = {
		ok: 'ONLINE',
		degraded: 'DEGRADED',
		down: 'UNREACHABLE',
	};

	const BREADCRUMB_PREFIXES = [
		['/auth/setup-admin', 'auth / setup-admin'],
		['/auth/setup', 'auth / setup'],
	] as const;

	type Props = {
		system: SystemInfo | null;
		children: Snippet;
	};

	let { system, children }: Props = $props();

	const breadcrumb = $derived(
		BREADCRUMB_PREFIXES.find(([p]) => page.url.pathname.startsWith(p))?.[1] ?? 'auth / sign-in'
	);

	const rollupStatus = $derived.by<RollupStatus>(() => {
		if (!system) return 'down';
		const c = system.components;
		if (c.postgres === 'down' || c.quickwit === 'down') return 'down';
		if (c.postgres === 'degraded' || c.quickwit === 'degraded') return 'degraded';
		return 'ok';
	});
</script>

<div class="flex min-h-0 flex-1">
	<SystemRail {system} />

	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex items-center justify-between px-8 py-4 font-mono text-xs">
			<span class="text-base-content/60">{breadcrumb}</span>
			<span
				class="hairline inline-flex items-center gap-2 rounded-box px-3 py-1"
				aria-live="polite"
			>
				<span aria-hidden="true" class="contents">
					<StatusDot status={rollupStatus} />
				</span>
				<span>{ROLLUP_LABEL[rollupStatus]}</span>
			</span>
		</div>

		<main class="flex flex-1 items-center justify-center px-4 pb-16">
			<div class="w-full max-w-sm">
				{@render children()}
			</div>
		</main>
	</div>
</div>
