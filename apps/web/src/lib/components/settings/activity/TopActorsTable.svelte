<script lang="ts">
	import { KeyRound } from 'lucide-svelte';

	import type { TopActors } from '#lib/api/activity.js';
	import ListCard from '#lib/components/ui/ListCard.svelte';
	import UserIdentity from '#lib/components/ui/UserIdentity.svelte';
	import { formatCount, formatDurationMs } from '#lib/utils/format.js';
	import type { Window } from '#lib/utils/time-range.js';

	let { rows, window }: { rows: TopActors; window: Window } = $props();
</script>

{#snippet apiKeyActor(id: string, label: string | null)}
	<div class="flex min-w-0 items-center gap-2">
		<span
			class="bg-base-200 text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
			aria-hidden="true"
		>
			<KeyRound class="size-3.5" aria-hidden="true" />
		</span>
		<span class="truncate text-sm">{label ?? id}</span>
	</div>
{/snippet}

<div class="flex flex-col gap-2">
	<p class="section-label">Top actors</p>
	<ListCard
		cols="minmax(0,1fr) auto auto"
		empty={rows.length === 0}
		emptyMessage="No actor activity in this window."
	>
		<div class="section-label col-span-full grid grid-cols-subgrid items-center px-4 py-2.5">
			<span>Actor</span>
			<span class="text-right">Searches</span>
			<span class="text-right">Avg</span>
		</div>
		{#each rows as r (r.id)}
			{@const href =
				r.kind === 'user'
					? `/settings/users/${r.id}?window=${window}`
					: `/settings/activity/api-keys/${r.id}?window=${window}`}
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
				<span class="text-right tabular-nums">{formatCount(r.count)}</span>
				<span class="text-right whitespace-nowrap tabular-nums">
					{formatDurationMs(r.avgDurationMs)}
				</span>
			</a>
		{/each}
	</ListCard>
</div>
