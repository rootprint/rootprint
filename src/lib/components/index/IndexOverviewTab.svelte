<script lang="ts">
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import type { AdminIndexDetail } from '$lib/types';

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

<section class="rounded-box border border-base-300 bg-base-100">
	<header class="px-4 py-3">
		<h3 class="text-base font-semibold">Schema details</h3>
	</header>

	<div class="grid grid-cols-1 gap-x-6 gap-y-4 px-4 pb-4 sm:grid-cols-2">
		{#snippet kv(label: string, value: string | null | undefined | boolean)}
			<div>
				<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
					{label}
				</div>
				<div class="mt-0.5 font-mono text-xs break-all text-base-content/80">
					{typeof value === 'boolean' ? (value ? 'true' : 'false') : (value ?? '—')}
				</div>
			</div>
		{/snippet}

		{@render kv('Index UID', detail.indexUid)}
		{@render kv('Mode', detail.mode)}
		{@render kv('Timestamp Field', detail.timestampField)}
		{@render kv('Version', detail.version)}
		{@render kv('Store Source', detail.storeSource)}
		{@render kv('Index Field Presence', detail.indexFieldPresence)}
		{@render kv('Store Doc Size', detail.storeDocumentSize)}
		{@render kv('Retention', formatRetention(detail.retention))}
	</div>

	{#if detail.tagFields && detail.tagFields.length > 0}
		<div class="border-t border-base-300 px-4 py-3">
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

	<div class="border-t border-base-300 px-4 py-3">
		<div class="mb-2 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
			Default Search Fields
		</div>
		{#if detail.defaultSearchFields && detail.defaultSearchFields.length > 0}
			<div class="flex flex-wrap gap-1">
				{#each detail.defaultSearchFields as field (field)}
					<span class="badge badge-sm">{field}</span>
				{/each}
			</div>
		{:else}
			<div class="text-xs text-base-content/50">—</div>
		{/if}
	</div>

	<div class="border-t border-base-300 px-4 py-3">
		<div class="mb-2 text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
			Index URI
		</div>
		{#if detail.indexUri}
			<div class="flex items-center gap-2">
				<code class="flex-1 font-mono text-xs break-all text-base-content/80"
					>{detail.indexUri}</code
				>
				<CopyButton
					text={detail.indexUri}
					class="btn btn-ghost btn-xs"
					title="Copy index URI"
					aria-label="Copy index URI"
				/>
			</div>
		{:else}
			<div class="text-xs text-base-content/50">—</div>
		{/if}
	</div>
</section>
