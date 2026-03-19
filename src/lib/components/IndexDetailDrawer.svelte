<script lang="ts">
	import { Info, ListTree, Plug, Settings, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import { getLocalIndexDetail, saveIndexConfig } from '$lib/api/indexes.remote';
	import { formatEpochLocale } from '$lib/utils/time';

	let {
		open = $bindable(false)
	}: {
		open: boolean;
	} = $props();

	let indexId = $state('');

	const tabs = [
		{ id: 'details', label: 'Details', icon: Info },
		{ id: 'fields', label: 'Fields', icon: ListTree },
		{ id: 'sources', label: 'Sources', icon: Plug },
		{ id: 'config', label: 'Config', icon: Settings }
	] as const;

	type TabId = (typeof tabs)[number]['id'];

	let activeTab = $state<TabId>('details');
	let detail = $state<Awaited<ReturnType<typeof getLocalIndexDetail>> | null>(null);
	let loading = $state(false);
	let fieldFilter = $state('');

	// Config form state
	let configLevelField = $state('');
	let configMessageField = $state('');
	let configTracebackField = $state('');
	let saving = $state(false);

	let requestId = 0;

	export async function loadDetail(id: string) {
		const thisRequest = ++requestId;
		indexId = id;
		loading = true;
		detail = null;
		activeTab = 'details';
		fieldFilter = '';
		try {
			const result = await getLocalIndexDetail(indexId);
			if (thisRequest !== requestId) return;
			detail = result;
			if (detail) {
				configLevelField = detail.levelField ?? 'level';
				configMessageField = detail.messageField ?? 'message';
				configTracebackField = detail.tracebackField ?? '';
			}
		} catch (e) {
			if (thisRequest !== requestId) return;
			toast.error(getErrorMessage(e, 'Failed to load index details'));
		} finally {
			if (thisRequest === requestId) loading = false;
		}
	}

	const filteredFields = $derived(
		detail?.fields.filter((f) => f.name.toLowerCase().includes(fieldFilter.toLowerCase())) ?? []
	);

	async function handleSaveConfig() {
		saving = true;
		try {
			await saveIndexConfig({
				indexId: indexId,
				levelField: configLevelField,
				messageField: configMessageField,
				tracebackField: configTracebackField
			});
			toast.success('Index configuration saved');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to save configuration'));
		} finally {
			saving = false;
		}
	}

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}

	function formatRetention(ret: unknown): string {
		if (!ret || typeof ret !== 'object') return '—';
		const r = ret as Record<string, unknown>;
		const parts: string[] = [];
		if (r.period) parts.push(`period: ${r.period}`);
		if (r.schedule) parts.push(`schedule: ${r.schedule}`);
		return parts.length > 0 ? parts.join(', ') : '—';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-10 bg-black/50"
		role="button"
		tabindex="-1"
		aria-label="close drawer"
		onclick={close}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') close();
		}}
	></div>

	<!-- Panel -->
	<div
		class="fixed top-0 right-0 z-20 flex h-full w-full flex-col border-l border-base-300 bg-base-100 shadow-lg md:w-[50vw]"
	>
		<!-- Header with tabs -->
		<div class="flex items-center justify-between border-b border-base-300 px-3">
			<div role="tablist" class="tabs-border tabs">
				{#each tabs as tab (tab.id)}
					{@const TabIcon = tab.icon}
					<button
						role="tab"
						class="tab gap-1.5"
						class:tab-active={activeTab === tab.id}
						onclick={() => (activeTab = tab.id)}
					>
						<TabIcon size={14} />
						{tab.label}
					</button>
				{/each}
			</div>
			<button class="btn btn-square btn-ghost btn-xs" onclick={close} title="Close">
				<X size={14} />
			</button>
		</div>

		<!-- Content -->
		{#if loading}
			<div class="flex flex-1 items-center justify-center">
				<span class="loading loading-sm loading-spinner"></span>
			</div>
		{:else if !detail}
			<div class="flex flex-1 items-center justify-center">
				<p class="text-sm text-base-content/50">Index not found</p>
			</div>
		{:else}
			<!-- Fields tab: filter bar above scroll area -->
			{#if activeTab === 'fields'}
				<div class="flex items-center gap-2 border-b border-base-300 px-4 py-2">
					<input
						class="input-bordered input input-sm flex-1"
						placeholder="Filter fields..."
						bind:value={fieldFilter}
					/>
					<span class="text-xs text-base-content/50">
						{filteredFields.length} field{filteredFields.length === 1 ? '' : 's'}
					</span>
				</div>
			{/if}

			<div class="flex-1 overflow-x-auto overflow-y-auto p-4">
				{#if activeTab === 'details'}
					<!-- DETAILS TAB -->
					<h3 class="mb-4 text-base font-semibold">{detail.indexId}</h3>
					<div class="grid grid-cols-2 gap-3">
						{#snippet kvItem(label: string, value: string | null | undefined | boolean)}
							<div>
								<div
									class="text-[10px] font-semibold uppercase tracking-wider text-base-content/50"
								>
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
							<div
								class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-base-content/50"
							>
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
							<div
								class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-base-content/50"
							>
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
						<div
							class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/50"
						>
							Retention
						</div>
						<div class="text-xs text-base-content/70">{formatRetention(detail.retention)}</div>
					</div>

					<!-- Index URI -->
					<div class="mt-3">
						<div
							class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/50"
						>
							Index URI
						</div>
						<div class="text-xs text-base-content/70 break-all">{detail.indexUri ?? '—'}</div>
					</div>
				{:else if activeTab === 'fields'}
					<!-- FIELDS TAB -->
					<table class="table table-sm">
						<thead class="sticky top-0 bg-base-100">
							<tr>
								<th>Name</th>
								<th>Type</th>
								<th>Fast</th>
								<th>Indexed</th>
								<th>Stored</th>
								<th>Record</th>
								<th>Tokenizer</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredFields as field (field.name)}
								<tr class="group hover:bg-base-200">
									<td>
										<div class="font-medium">{field.name}</div>
										{#if field.description}
											<div class="text-[10px] text-base-content/60">
												{field.description}
											</div>
										{/if}
									</td>
									<td>
										<span class="badge badge-sm">{field.type}</span>
									</td>
									<td>
										{#if field.fast}
											<span class="text-success">✓</span>
										{:else}
											<span class="text-base-content/50">—</span>
										{/if}
									</td>
									<td>
										{#if field.indexed}
											<span class="text-success">✓</span>
										{:else}
											<span class="text-base-content/50">—</span>
										{/if}
									</td>
									<td>
										{#if field.stored}
											<span class="text-success">✓</span>
										{:else}
											<span class="text-base-content/50">—</span>
										{/if}
									</td>
									<td class="text-base-content/60">{field.record ?? '—'}</td>
									<td class="text-base-content/60">{field.tokenizer ?? '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else if activeTab === 'sources'}
					<!-- SOURCES TAB -->
					<div class="mb-3 text-xs text-base-content/50">
						{detail.sources.length} source{detail.sources.length === 1 ? '' : 's'} configured
					</div>
					<div class="flex flex-col gap-2">
						{#each detail.sources as source (source.sourceId)}
							<div
								class="rounded border border-base-300 p-3"
								class:opacity-50={source.enabled === false}
							>
								<div class="mb-2 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="font-medium">{source.sourceId}</span>
										<span class="badge badge-sm">{source.sourceType}</span>
									</div>
									{#if source.enabled !== false}
										<span class="text-xs text-success">● enabled</span>
									{:else}
										<span class="text-xs text-error">● disabled</span>
									{/if}
								</div>
								<div class="grid grid-cols-3 gap-2 text-xs">
									<div>
										<div class="text-[10px] uppercase text-base-content/50">Input Format</div>
										<div class="text-base-content/70">{source.inputFormat ?? '—'}</div>
									</div>
									<div>
										<div class="text-[10px] uppercase text-base-content/50">Pipelines</div>
										<div class="text-base-content/70">
											{source.numPipelines ?? 0} / {source.desiredNumPipelines ?? 0} desired
										</div>
									</div>
									<div>
										<div class="text-[10px] uppercase text-base-content/50">Max Per Indexer</div>
										<div class="text-base-content/70">
											{source.maxNumPipelinesPerIndexer ?? '—'}
										</div>
									</div>
								</div>
								{#if source.params}
									<div class="mt-2 border-t border-base-300 pt-2">
										<div class="mb-1 text-[10px] uppercase text-base-content/50">Params</div>
										<pre
											class="overflow-x-auto rounded bg-base-200 p-2 font-['Roboto_Mono',monospace] text-[10px] text-base-content/70"
										>{JSON.stringify(source.params, null, 2)}</pre>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if activeTab === 'config'}
					<!-- CONFIG TAB -->
					<h3 class="mb-1 text-sm font-semibold">Logwiz Configuration</h3>
					<p class="mb-4 text-xs text-base-content/50">
						Map Quickwit fields to Logwiz display roles
					</p>
					<div class="flex flex-col gap-4">
						<div>
							<label class="mb-1 block text-xs font-medium" for="levelField"
								>Level Field</label
							>
							<input
								id="levelField"
								type="text"
								class="input-bordered input input-sm w-full"
								bind:value={configLevelField}
								placeholder="e.g. level, severity"
							/>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium" for="messageField">
								Message Field
							</label>
							<input
								id="messageField"
								type="text"
								class="input-bordered input input-sm w-full"
								bind:value={configMessageField}
								placeholder="e.g. message, body.message"
							/>
						</div>
					<div>
						<label class="mb-1 block text-xs font-medium" for="tracebackField">
							Traceback Field
						</label>
						<input
							id="tracebackField"
							type="text"
							class="input-bordered input input-sm w-full"
							bind:value={configTracebackField}
							placeholder="e.g. message.traceback, attributes.exception.stacktrace"
						/>
						<p class="mt-1 text-[10px] text-base-content/40">
							Dot-notation path to the field containing stacktrace/traceback data
						</p>
					</div>
						<div>
							<button
								class="btn btn-sm btn-accent"
								onclick={handleSaveConfig}
								disabled={saving}
							>
								{#if saving}
									<span class="loading loading-xs loading-spinner"></span>
									Saving...
								{:else}
									Save
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
