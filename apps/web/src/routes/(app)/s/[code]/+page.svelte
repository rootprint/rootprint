<script lang="ts">
	import { CircleX } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { serialize } from '$lib/utils/query-params';

	let { data } = $props();

	const message = $derived.by(() => {
		switch (data.error) {
			case 'forbidden':
				return "You don't have access to this share link's index.";
			case 'not_found':
				return "This share link doesn't exist or was removed.";
			case 'unknown':
				return 'Failed to load share link.';
			default:
				return '';
		}
	});

	$effect(() => {
		if (!data.share) return;
		const { indexId, query, startTime, endTime, hit, filters } = data.share;
		const params = serialize({
			index: indexId,
			query,
			timeRange: { type: 'absolute', start: startTime, end: endTime },
			timezoneMode: 'local',
			sortDirection: 'desc',
			filters
		});
		void goto(`/?${params.toString()}`, {
			replaceState: true,
			state: { openHit: hit }
		});
	});
</script>

{#if data.error}
	<div class="flex h-full items-center justify-center p-6">
		<div class="alert alert-warning max-w-md">
			<CircleX class="h-4 w-4 shrink-0" />
			<div class="flex flex-col gap-2">
				<span class="text-xs">{message}</span>
				<a href="/" class="link link-primary text-xs">← Back to logs</a>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-full items-center justify-center">
		<span class="loading loading-spinner loading-sm"></span>
	</div>
{/if}
