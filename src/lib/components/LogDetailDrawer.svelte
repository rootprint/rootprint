<script lang="ts">
	import JsonHighlight from '$lib/components/JsonHighlight.svelte';
	import { ListTree, Braces, X, CirclePlus, CircleMinus, Check, Copy, Bug } from 'lucide-svelte';
	import { resolveFieldValue, formatFieldValue } from '$lib/utils/field-resolver';
	import TracebackView from '$lib/components/TracebackView.svelte';
	import { flattenObject } from '$lib/utils/log-helpers';
	import { toast } from 'svelte-sonner';
	let {
		open = $bindable(false),
		hit = null,
		timestampField = 'timestamp',
		tracebackField = null as string | null,
		onfilter
	}: {
		open: boolean;
		hit: Record<string, unknown> | null;
		timestampField?: string;
		tracebackField?: string | null;
		onfilter?: (key: string, value: string, exclude: boolean) => void;
	} = $props();

	const tracebackContent = $derived.by(() => {
		if (!hit || !tracebackField) return null;
		const raw = resolveFieldValue(hit, tracebackField);
		if (typeof raw !== 'string' || raw.trim() === '') return null;
		return raw;
	});

	const tabs = $derived.by(() => {
		const base: { id: string; label: string; icon: typeof ListTree }[] = [
			{ id: 'parameters', label: 'Parameters', icon: ListTree },
			{ id: 'json', label: 'JSON', icon: Braces }
		];
		if (tracebackContent) {
			base.push({ id: 'traceback', label: 'Traceback', icon: Bug });
		}
		return base;
	});

	const flatParams = $derived(
		hit ? flattenObject(hit).filter(([key]) => key !== timestampField) : []
	);

	function handleFilter(key: string, value: unknown, exclude: boolean) {
		if (value === null || value === undefined) return;
		onfilter?.(key, formatFieldValue(value), exclude);
	}

	let activeTab = $state<'parameters' | 'json' | 'traceback'>('parameters');
	let copied = $state(false);

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}

	const prettyJson = $derived(hit ? JSON.stringify(hit, null, 2) : '');
	const jsonLines = $derived(prettyJson.split('\n'));

	async function copyJson() {
		try {
			await navigator.clipboard.writeText(prettyJson);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (e) {
			toast.error('Failed to copy to clipboard');
		}
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
	<div class="fixed top-0 right-0 z-20 flex h-full w-full flex-col border-l border-base-300 bg-base-100 shadow-lg md:w-[50vw]">
		<div class="flex items-center justify-between border-b border-base-300 px-3">
			<div role="tablist" class="tabs-border tabs">
				{#each tabs as tab (tab.id)}
					{@const TabIcon = tab.icon}
					<button
						role="tab"
						class="tab gap-1.5"
						class:tab-active={activeTab === tab.id}
						onclick={() => (activeTab = tab.id as typeof activeTab)}
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

		<div class="flex-1 overflow-auto p-4">
			{#if activeTab === 'json'}
				{#if hit}
					<div class="relative rounded-box bg-base-200">
						<button class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs" onclick={copyJson}>
							{#if copied}
								<Check size={14} />
							{:else}
								<Copy size={14} />
							{/if}
						</button>
						<div class="py-3 font-['Roboto_Mono',monospace] text-sm">
							{#each jsonLines as line, i (i)}
								<div class="flex leading-relaxed">
									<div class="w-10 shrink-0 border-r border-base-300 pr-3 text-right text-base-content/50 select-none">{i + 1}</div>
									<div class="flex-1 break-all whitespace-pre-wrap pl-3 pr-3">
										<JsonHighlight code={line} />
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else if activeTab === 'parameters'}
				{#if hit}
					<table class="table table-sm">
						<thead>
							<tr>
								<th class="w-0 pr-0"></th>
								<th class="w-1/3 pl-0">Key</th>
								<th>Value</th>
							</tr>
						</thead>
						<tbody>
							{#each flatParams as [key, value] (key)}
								<tr class="group">
									<td class="py-0 pr-0 align-middle">
										{#if value !== null && value !== undefined}
											<div class="flex items-center gap-0">
												<button
													class="btn btn-square h-5 min-h-0 w-5 btn-ghost btn-xs"
													title="Filter for value"
													onclick={() => handleFilter(key, value, false)}
												>
													<CirclePlus
														size={12}
														class="text-success"
													/>
												</button>
												<button
													class="btn btn-square h-5 min-h-0 w-5 btn-ghost btn-xs"
													title="Filter out value"
													onclick={() => handleFilter(key, value, true)}
												>
													<CircleMinus
														size={12}
														class="text-error"
													/>
												</button>
											</div>
										{/if}
									</td>
									<td class="pl-1 font-['Roboto_Mono',monospace] text-xs text-base-content/70"
										>{key}</td
									>
									<td class="font-['Roboto_Mono',monospace] text-xs break-all">
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
			{:else if activeTab === 'traceback'}
				{#if tracebackContent}
					<TracebackView traceback={tracebackContent} />
				{/if}
			{/if}
		</div>
	</div>
{/if}
