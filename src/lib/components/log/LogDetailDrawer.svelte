<script lang="ts">
	import JsonHighlight from '$lib/components/ui/JsonHighlight.svelte';
	import { ListTree, Braces, Bug, Logs, Share2, Loader2 } from 'lucide-svelte';
	import { createSharedLink } from '$lib/api/shared-links.remote';
	import { toast } from 'svelte-sonner';
	import { resolveFieldValue, formatFieldValue } from '$lib/utils/field-resolver';
	import TracebackView from '$lib/components/log/TracebackView.svelte';
	import LogContextView from './LogContextView.svelte';
	import { flattenObject } from '$lib/utils/log-helpers';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import Drawer from '$lib/components/ui/Drawer.svelte';

	let {
		open = $bindable(false),
		hit = null,
		timestampField = 'timestamp',
		tracebackField = null as string | null,
		indexId = '',
		messageField = 'message',
		levelField = 'level',
		timezoneMode = 'utc' as 'utc' | 'local',
		query = '',
		timeRange = null as { start: number; end: number } | null
	}: {
		open: boolean;
		hit: Record<string, unknown> | null;
		timestampField?: string;
		tracebackField?: string | null;
		indexId?: string;
		messageField?: string;
		levelField?: string;
		timezoneMode?: 'utc' | 'local';
		query?: string;
		timeRange?: { start: number; end: number } | null;
	} = $props();

	let sharing = $state(false);

	async function handleShare() {
		if (!hit || !timeRange || sharing) return;
		sharing = true;
		try {
			const { code } = await createSharedLink({
				indexName: indexId,
				query,
				startTime: timeRange.start,
				endTime: timeRange.end,
				hit,
				timestampField
			});
			const url = `${window.location.origin}/share/${code}`;
			await navigator.clipboard.writeText(url);
			toast.success('Link copied to clipboard');
		} catch {
			toast.error('Failed to create shared link');
		} finally {
			sharing = false;
		}
	}

	const tracebackContent = $derived.by(() => {
		if (!hit || !tracebackField) return null;
		const raw = resolveFieldValue(hit, tracebackField);
		if (typeof raw !== 'string' || raw.trim() === '') return null;
		return raw;
	});

	const tabs = $derived.by(() => {
		const base: { id: string; label: string; icon: typeof ListTree }[] = [
			{ id: 'parameters', label: 'Parameters', icon: ListTree },
			{ id: 'json', label: 'JSON', icon: Braces },
			{ id: 'context', label: 'Context', icon: Logs }
		];
		if (tracebackContent) {
			base.push({ id: 'traceback', label: 'Traceback', icon: Bug });
		}
		return base;
	});

	const flatParams = $derived(
		hit ? flattenObject(hit).filter(([key]) => key !== timestampField) : []
	);

	let activeTab = $state<'parameters' | 'json' | 'context' | 'traceback'>('parameters');

	const prettyJson = $derived(hit ? JSON.stringify(hit, null, 2) : '');
	const jsonLines = $derived(prettyJson.split('\n'));
</script>

<Drawer bind:open {tabs} bind:activeTab>
	{#snippet actions()}
		<button
			class="btn btn-ghost btn-xs"
			title="Share link to this log"
			onclick={handleShare}
			disabled={sharing || !hit || !timeRange}
		>
			{#if sharing}
				<Loader2 size={14} class="animate-spin" />
			{:else}
				<Share2 size={14} />
			{/if}
		</button>
	{/snippet}
	<div class="flex-1 overflow-auto p-4">
		{#if activeTab === 'json'}
			{#if hit}
				<div class="relative rounded-box bg-base-200">
					<CopyButton text={prettyJson} class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs" />
					<div class="py-3 font-['Roboto_Mono',monospace] text-sm">
						{#each jsonLines as line, i (i)}
							<div class="flex leading-relaxed">
								<div
									class="w-10 shrink-0 border-r border-base-300 pr-3 text-right text-base-content/50 select-none"
								>
									{i + 1}
								</div>
								<div class="flex-1 pr-3 pl-3 break-all whitespace-pre-wrap">
									<JsonHighlight code={line} />
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{:else if activeTab === 'parameters'}
			{#if hit}
				<table class="table w-full border border-base-300 table-sm">
					<thead>
						<tr>
							<th class="w-1/3 border border-base-300 bg-base-200/50">Key</th>
							<th class="border border-base-300 bg-base-200/50">Value</th>
						</tr>
					</thead>
					<tbody>
						{#each flatParams as [key, value] (key)}
							<tr class="hover:bg-base-200/50">
								<td
									class="border border-base-300 font-['Roboto_Mono',monospace] text-xs font-medium text-base-content/80"
									>{key}</td
								>
								<td
									class="border border-base-300 font-['Roboto_Mono',monospace] text-xs [overflow-wrap:break-word]"
								>
									{#if value === null || value === undefined}
										<span class="text-base-content/50 italic">null</span>
									{:else}
										{formatFieldValue(value)}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else if activeTab === 'context'}
			{#if hit}
				<LogContextView
					{hit}
					{indexId}
					{messageField}
					{levelField}
					{timestampField}
					{timezoneMode}
				/>
			{/if}
		{:else if activeTab === 'traceback'}
			{#if tracebackContent}
				<TracebackView traceback={tracebackContent} />
			{/if}
		{/if}
	</div>
</Drawer>
