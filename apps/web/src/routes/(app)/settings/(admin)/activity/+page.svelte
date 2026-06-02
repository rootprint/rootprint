<script lang="ts">
	import { KeyRound } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import KpiStrip from '$lib/components/activity/KpiStrip.svelte';
	import LatencyChart from '$lib/components/activity/LatencyChart.svelte';
	import TimeRangeTabs from '$lib/components/activity/TimeRangeTabs.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import UserIdentity from '$lib/components/ui/UserIdentity.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { Window } from '$lib/api/activity';
	import { formatDurationMs } from '$lib/utils/format';

	let { data } = $props();

	function setWindow(next: Window) {
		const url = new URL(page.url);
		url.searchParams.set('window', next);
		goto(url, { replaceState: false, keepFocus: true, noScroll: true });
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Search activity" description="Search latency, volume, and per-actor usage.">
		{#snippet actions()}
			<TimeRangeTabs value={data.window} onChange={setWindow} />
		{/snippet}
	</PageHeader>

	{#snippet apiKeyActor(id: string, label: string | null)}
		<div class="flex min-w-0 items-center gap-2">
			<span
				class="bg-base-200 text-base-content/60 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
				aria-hidden="true"
			>
				<KeyRound class="h-3.5 w-3.5" />
			</span>
			<span class="truncate text-sm">{label ?? id}</span>
		</div>
	{/snippet}

	<div class="mt-8 flex flex-col gap-4">
		{#await data.summary}
			<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
		{:then s}
			<KpiStrip totalSearches={s.totalSearches} p50={s.p50} p95={s.p95} p99={s.p99} />
		{:catch e}
			{void console.error('[activity] summary failed', e)}
		{/await}

		{#await data.latency}
			<div class="bg-base-200 rounded-box h-72 animate-pulse"></div>
		{:then buckets}
			<LatencyChart {buckets} window={data.window} />
		{:catch e}
			{void console.error('[activity] latency failed', e)}
		{/await}

		{#await data.topActors then rows}
			<div class="flex flex-col gap-2">
				<p class="eyebrow">Top actors</p>
				<ListCard
					cols="minmax(0,1fr) auto auto"
					gap="gap-x-8"
					empty={rows.length === 0}
					emptyMessage="No actor activity in this window."
				>
					<div
						class="text-base-content/50 col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-[10px] tracking-wide uppercase"
					>
						<span>Actor</span>
						<span class="text-right">Searches</span>
						<span class="text-right">Avg</span>
					</div>
					{#each rows as r (r.id)}
						{@const href =
							r.kind === 'user'
								? `/settings/users/${r.id}?window=${data.window}`
								: `/settings/activity/api-keys/${r.id}?window=${data.window}`}
						<a
							{href}
							class="hover:bg-base-200/40 col-span-full grid grid-cols-subgrid items-center px-4 py-3.5 text-sm"
						>
							<span class="min-w-0">
								{#if r.kind === 'user'}
									<UserIdentity id={r.id} name={r.label} size="sm" />
								{:else}
									{@render apiKeyActor(r.id, r.label)}
								{/if}
							</span>
							<span class="text-right tabular-nums">{r.count.toLocaleString()}</span>
							<span class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMs(r.avgDurationMs)}
							</span>
						</a>
					{/each}
				</ListCard>
			</div>
		{:catch e}
			{void console.error('[activity] top-actors failed', e)}
		{/await}
	</div>
</div>
