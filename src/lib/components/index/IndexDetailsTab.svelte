<script lang="ts">
	import type { AdminIndexDetail } from '$lib/types';
	import { formatEpochLocale } from '$lib/utils/time';

	let { detail }: { detail: AdminIndexDetail } = $props();

	function formatRetention(ret: unknown): string {
		if (!ret || typeof ret !== 'object') return '—';
		const r = ret as Record<string, unknown>;
		const parts: string[] = [];
		if (r.period) parts.push(`period: ${r.period}`);
		if (r.schedule) parts.push(`schedule: ${r.schedule}`);
		return parts.length > 0 ? parts.join(', ') : '—';
	}
</script>

<div class="grid grid-cols-2 gap-3">
	{#snippet kvItem(label: string, value: string | null | undefined | boolean)}
		<div>
			<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
				{label}
			</div>
			<div class="mt-0.5 text-xs text-base-content/70">
				{#if typeof value === 'boolean'}
					{value ? 'true' : 'false'}
				{:else}
					{value ?? '—'}
				{/if}
			</div>
		</div>
	{/snippet}

	{@render kvItem('Index UID', detail.indexUid)}
	{@render kvItem('Mode', detail.mode)}
	{@render kvItem('Timestamp Field', detail.timestampField)}
	{@render kvItem('Version', detail.version)}
	{@render kvItem('Created', formatEpochLocale(detail.createTimestamp))}
	{@render kvItem('Store Source', detail.storeSource)}
	{@render kvItem('Store Doc Size', detail.storeDocumentSize)}
	{@render kvItem('Index Field Presence', detail.indexFieldPresence)}
</div>

<!-- Tag fields -->
{#if detail.tagFields && detail.tagFields.length > 0}
	<div class="mt-4 border-t border-base-300 pt-4">
		<div class="mb-2 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
			Tag Fields
		</div>
		<div class="flex flex-wrap gap-1">
			{#each detail.tagFields as tag (tag)}
				<span class="badge badge-sm">{tag}</span>
			{/each}
		</div>
	</div>
{/if}

<!-- Default search fields -->
{#if detail.defaultSearchFields && detail.defaultSearchFields.length > 0}
	<div class="mt-3">
		<div class="mb-2 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
			Default Search Fields
		</div>
		<div class="flex flex-wrap gap-1">
			{#each detail.defaultSearchFields as field (field)}
				<span class="badge badge-sm">{field}</span>
			{/each}
		</div>
	</div>
{/if}

<!-- Retention -->
<div class="mt-4 border-t border-base-300 pt-4">
	<div class="mb-1 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
		Retention
	</div>
	<div class="text-xs text-base-content/70">{formatRetention(detail.retention)}</div>
</div>

<!-- Index URI -->
<div class="mt-3">
	<div class="mb-1 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
		Index URI
	</div>
	<div class="text-xs break-all text-base-content/70">{detail.indexUri ?? '—'}</div>
</div>
