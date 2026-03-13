<script lang="ts">
	import JsonHighlight from '$lib/components/JsonHighlight.svelte';
	import Icon from '@iconify/svelte';
	import { formatFieldValue } from '$lib/utils/field-resolver';
	import { escapeFilterValue } from '$lib/utils/query';

	let {
		open = $bindable(false),
		hit = null,
		timestampField = 'timestamp',
		onfilter
	}: {
		open: boolean;
		hit: Record<string, unknown> | null;
		timestampField?: string;
		onfilter?: (key: string, value: string, exclude: boolean) => void;
	} = $props();

	const tabs = [
		{ id: 'parameters', label: 'Parameters', icon: 'lucide:list-tree' },
		{ id: 'json', label: 'JSON', icon: 'lucide:braces' }
	] as const;

	function flattenObject(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
		const result: [string, unknown][] = [];
		for (const [key, value] of Object.entries(obj)) {
			const fullKey = prefix ? `${prefix}.${key}` : key;
			if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
				result.push(...flattenObject(value as Record<string, unknown>, fullKey));
			} else {
				result.push([fullKey, value]);
			}
		}
		return result;
	}

	const flatParams = $derived(
		hit ? flattenObject(hit).filter(([key]) => key !== timestampField) : []
	);

	function handleFilter(key: string, value: unknown, exclude: boolean) {
		if (value === null || value === undefined) return;
		onfilter?.(key, escapeFilterValue(formatFieldValue(value)), exclude);
	}

	let activeTab = $state<(typeof tabs)[number]['id']>('parameters');
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
		await navigator.clipboard.writeText(prettyJson);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/50"
		role="button"
		tabindex="-1"
		aria-label="close drawer"
		onclick={close}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') close();
		}}
	></div>

	<!-- Panel -->
	<div class="fixed top-0 right-0 z-50 flex h-full w-[50vw] flex-col bg-base-100">
		<div class="flex items-center justify-between border-b border-base-300 px-4 py-3">
			<span class="text-sm font-semibold">Log Detail</span>
			<button class="btn btn-square btn-ghost btn-sm" onclick={close}>
				<Icon icon="lucide:x" width="16" height="16" />
			</button>
		</div>

		<div role="tablist" class="tabs-border tabs px-4">
			{#each tabs as tab (tab.id)}
				<button
					role="tab"
					class="tab gap-1.5"
					class:tab-active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					<Icon icon={tab.icon} width="14" height="14" />
					{tab.label}
				</button>
			{/each}
		</div>

		<div class="flex-1 overflow-auto p-4">
			{#if activeTab === 'json'}
				{#if hit}
					<div class="relative rounded-box bg-base-200">
						<button
							class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs"
							onclick={copyJson}
						>
							<Icon
								icon={copied ? 'lucide:check' : 'lucide:copy'}
								width="14"
								height="14"
							/>
						</button>
						<div class="flex font-['Roboto_Mono',monospace] text-sm">
							<div
								class="border-r border-base-300 py-3 pr-3 pl-3 text-right text-base-content/30 select-none"
							>
								{#each jsonLines as _, i (i)}
									<div class="leading-relaxed">{i + 1}</div>
								{/each}
							</div>
							<div class="flex-1 overflow-x-auto py-3 pr-3 pl-3">
								<JsonHighlight code={prettyJson} />
							</div>
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
													<Icon
														icon="lucide:plus-circle"
														width="12"
														height="12"
														class="text-success"
													/>
												</button>
												<button
													class="btn btn-square h-5 min-h-0 w-5 btn-ghost btn-xs"
													title="Filter out value"
													onclick={() => handleFilter(key, value, true)}
												>
													<Icon
														icon="lucide:minus-circle"
														width="12"
														height="12"
														class="text-error"
													/>
												</button>
											</div>
										{/if}
									</td>
									<td
										class="pl-1 font-['Roboto_Mono',monospace] text-xs text-base-content/70"
										>{key}</td
									>
									<td class="font-['Roboto_Mono',monospace] text-xs break-all">
										{#if value === null || value === undefined}
											<span class="text-base-content/30 italic">null</span>
										{:else}
											{formatFieldValue(value)}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/if}
		</div>
	</div>
{/if}
