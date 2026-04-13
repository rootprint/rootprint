<script lang="ts">
	import {
		Braces,
		Bug,
		ChevronDown,
		ChevronRight,
		ListTree,
		Loader2,
		Logs,
		Share2
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { slide } from 'svelte/transition';

	import { createSharedLink } from '$lib/api/shared-links.remote';
	import TracebackView from '$lib/components/log/TracebackView.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import JsonHighlight from '$lib/components/ui/JsonHighlight.svelte';
	import { formatFieldValue, resolveFieldValue } from '$lib/utils/field-resolver';
	import { flattenObject, isEmpty } from '$lib/utils/log-helpers';

	import LogContextView from './LogContextView.svelte';

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
		timeRange = null as { start: number; end: number } | null,
		isOtelIndex = false,
		onfilter
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
		isOtelIndex?: boolean;
		onfilter?: (field: string, value: string) => void;
	} = $props();

	let sharing = $state(false);

	let copiedField = $state<string | null>(null);

	async function handleCopy(key: string, value: unknown) {
		const text = value == null ? 'null' : formatFieldValue(value);
		try {
			await navigator.clipboard.writeText(text);
			copiedField = key;
			toast.success('Value copied to clipboard');
			setTimeout(() => {
				if (copiedField === key) copiedField = null;
			}, 1500);
		} catch {
			toast.error('Failed to copy value');
		}
	}

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

	const flatParams = $derived(hit ? flattenObject(hit) : []);

	const messageValue = $derived.by(() => {
		if (!hit) return null;
		const raw = resolveFieldValue(hit, messageField);
		if (raw == null || raw === '') return null;
		return String(raw);
	});

	let hideEmpty = $state(true);

	const filteredParams = $derived(
		hideEmpty ? flatParams.filter(([, value]) => !isEmpty(value)) : flatParams
	);

	function otelDisplayName(key: string): string {
		if (key.startsWith('resource_attributes.')) return key.slice(20);
		if (key.startsWith('attributes.')) return key.slice(11);
		return key;
	}

	const attrParams = $derived(filteredParams.filter(([key]) => key.startsWith('attributes.')));
	const resourceAttrParams = $derived(
		filteredParams.filter(([key]) => key.startsWith('resource_attributes.'))
	);
	const otherParams = $derived(
		filteredParams.filter(
			([key]) => !key.startsWith('attributes.') && !key.startsWith('resource_attributes.')
		)
	);

	let attrCollapsed = $state(false);
	let resourceAttrCollapsed = $state(false);
	let otherCollapsed = $state(false);

	let activeTab = $state<'parameters' | 'json' | 'context' | 'traceback'>('parameters');

	const prettyJson = $derived(hit ? JSON.stringify(hit, null, 2) : '');
	const jsonLines = $derived(prettyJson.split('\n'));

	function isFilterable(value: unknown): boolean {
		if (value == null) return false;
		if (value === '') return false;
		if (typeof value === 'object') return false;
		return true;
	}

	function handleFilterClick(field: string, value: unknown) {
		if (onfilter && isFilterable(value)) {
			onfilter(field, formatFieldValue(value));
		}
	}
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
				{#snippet paramTable(params: [string, unknown][], stripPrefix: boolean)}
					<table
						class="table w-full table-fixed rounded-none border-[0.5px] border-base-content/20 table-sm"
					>
						<tbody>
							{#each params as [key, value] (key)}
								<tr class="group/row hover:bg-base-200/50">
									<td
										class="w-2/5 border-[0.5px] border-base-content/20 font-['Roboto_Mono',monospace] text-xs font-medium text-base-content/80"
										>{stripPrefix ? otelDisplayName(key) : key}</td
									>
									<td
										class="relative border-[0.5px] border-base-content/20 font-['Roboto_Mono',monospace] text-xs [overflow-wrap:break-word]"
									>
										{#if value === null || value === undefined}
											<span class="text-base-content/50 italic">null</span>
										{:else}
											{formatFieldValue(value)}
										{/if}
										<div
											class="absolute inset-y-0 right-0 flex items-center pr-1 md:pointer-events-none md:opacity-0 md:group-focus-within/row:pointer-events-auto md:group-focus-within/row:opacity-100 md:group-hover/row:pointer-events-auto md:group-hover/row:opacity-100"
										>
											<div
												class="pointer-events-none h-full w-6 bg-gradient-to-r from-transparent to-base-200/50"
											></div>
											<div class="pointer-events-auto flex items-center gap-0.5 bg-base-200/50">
												{#if onfilter && isFilterable(value)}
													<button
														type="button"
														class="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-base-300 hover:text-primary"
														onclick={() => handleFilterClick(key, value)}
													>
														Filter
													</button>
												{/if}
												<button
													type="button"
													class="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-base-300 hover:text-primary"
													onclick={() => handleCopy(key, value)}
												>
													{copiedField === key ? 'Copied!' : 'Copy'}
												</button>
											</div>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/snippet}

				{#if messageValue}
					<div class="mb-4">
						<div class="mb-1 text-xs font-semibold tracking-wider text-base-content/60 uppercase">
							{messageField}
						</div>
						<div
							class="rounded-box bg-base-200 p-3 font-['Roboto_Mono',monospace] text-sm break-all whitespace-pre-wrap"
						>
							{messageValue}
						</div>
					</div>
				{/if}

				<label class="mb-3 flex items-center gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-xs"
						checked={!hideEmpty}
						onchange={() => (hideEmpty = !hideEmpty)}
					/>
					<span class="text-xs text-base-content/70">Show empty values</span>
				</label>

				{#if isOtelIndex}
					{#if attrParams.length > 0}
						<div class="mb-2">
							<button
								type="button"
								class="flex items-center py-2"
								onclick={() => (attrCollapsed = !attrCollapsed)}
							>
								{#if attrCollapsed}
									<ChevronRight size={14} class="mr-1 text-base-content/60" />
								{:else}
									<ChevronDown size={14} class="mr-1 text-base-content/60" />
								{/if}
								<span class="text-xs font-bold tracking-wider text-base-content uppercase">
									Attributes ({attrParams.length})
								</span>
							</button>
							{#if !attrCollapsed}
								<div transition:slide={{ duration: 200 }}>
									{@render paramTable(attrParams, true)}
								</div>
							{/if}
						</div>
					{/if}
					{#if resourceAttrParams.length > 0}
						<div class="mb-2">
							<button
								type="button"
								class="flex items-center py-2"
								onclick={() => (resourceAttrCollapsed = !resourceAttrCollapsed)}
							>
								{#if resourceAttrCollapsed}
									<ChevronRight size={14} class="mr-1 text-base-content/60" />
								{:else}
									<ChevronDown size={14} class="mr-1 text-base-content/60" />
								{/if}
								<span class="text-xs font-bold tracking-wider text-base-content uppercase">
									Resource Attributes ({resourceAttrParams.length})
								</span>
							</button>
							{#if !resourceAttrCollapsed}
								<div transition:slide={{ duration: 200 }}>
									{@render paramTable(resourceAttrParams, true)}
								</div>
							{/if}
						</div>
					{/if}
					{#if otherParams.length > 0}
						<div class="mb-2">
							<button
								type="button"
								class="flex items-center py-2"
								onclick={() => (otherCollapsed = !otherCollapsed)}
							>
								{#if otherCollapsed}
									<ChevronRight size={14} class="mr-1 text-base-content/60" />
								{:else}
									<ChevronDown size={14} class="mr-1 text-base-content/60" />
								{/if}
								<span class="text-xs font-bold tracking-wider text-base-content uppercase">
									Other Fields ({otherParams.length})
								</span>
							</button>
							{#if !otherCollapsed}
								<div transition:slide={{ duration: 200 }}>
									{@render paramTable(otherParams, false)}
								</div>
							{/if}
						</div>
					{/if}
				{:else}
					{@render paramTable(filteredParams, false)}
				{/if}
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
