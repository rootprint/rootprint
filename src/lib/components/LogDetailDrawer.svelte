<script lang="ts">
	import type { Snippet } from 'svelte';
	import JsonHighlight from '$lib/components/JsonHighlight.svelte';
	import Icon from '@iconify/svelte';
	import { escapeFilterValue } from '$lib/utils/query';

	let {
		open = $bindable(false),
		hit = null,
		timestampField = 'timestamp',
		onfilter,
		children
	}: {
		open: boolean;
		hit: Record<string, unknown> | null;
		timestampField?: string;
		onfilter?: (key: string, value: string, exclude: boolean) => void;
		children: Snippet;
	} = $props();

	const drawerId = 'log-detail-drawer';

	const tabs = [
		{ id: 'parameters', label: 'Parameters', icon: 'lucide:list-tree' },
		{ id: 'json', label: 'JSON', icon: 'lucide:braces' }
	] as const;

	function flattenObject(
		obj: Record<string, unknown>,
		prefix = ''
	): [string, unknown][] {
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
		const str = Array.isArray(value) ? JSON.stringify(value) : String(value);
		onfilter?.(key, escapeFilterValue(str), exclude);
		open = false;
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

<div class="drawer drawer-end h-full">
	<input
		id={drawerId}
		type="checkbox"
		class="drawer-toggle"
		checked={open}
		onchange={(e) => (open = e.currentTarget.checked)}
	/>
	<div class="drawer-content h-full overflow-hidden">
		{@render children()}
	</div>
	<div class="drawer-side z-50">
		<label for={drawerId} aria-label="close sidebar" class="drawer-overlay"></label>
		<div class="flex h-full w-[50vw] flex-col bg-base-100">
			<div class="flex items-center justify-between border-b border-base-300 px-4 py-3">
				<span class="text-sm font-semibold">Log Detail</span>
				<button class="btn btn-square btn-ghost btn-sm" onclick={close}>
					<Icon icon="lucide:x" width="16" height="16" />
				</button>
			</div>

			<div role="tablist" class="tabs tabs-border px-4">
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
						<div class="bg-base-200 rounded-box relative">
							<button
								class="btn btn-ghost btn-xs absolute top-2 right-2 z-10"
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
									class="text-base-content/30 select-none border-r border-base-300 py-3 pr-3 pl-3 text-right"
								>
									{#each jsonLines as _, i (i)}
										<div class="leading-relaxed">{i + 1}</div>
									{/each}
								</div>
								<div class="flex-1 overflow-x-auto py-3 pl-3 pr-3">
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
										<td class="pr-0 py-0 align-middle">
											{#if value !== null && value !== undefined}
												<div class="flex gap-0 items-center">
													<button
														class="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5"
														title="Filter for value"
														onclick={() => handleFilter(key, value, false)}
													>
														<Icon icon="lucide:plus-circle" width="12" height="12" class="text-success" />
													</button>
													<button
														class="btn btn-ghost btn-xs btn-square min-h-0 h-5 w-5"
														title="Filter out value"
														onclick={() => handleFilter(key, value, true)}
													>
														<Icon icon="lucide:minus-circle" width="12" height="12" class="text-error" />
													</button>
												</div>
											{/if}
										</td>
										<td class="font-['Roboto_Mono',monospace] text-xs text-base-content/70 pl-1">{key}</td>
										<td class="font-['Roboto_Mono',monospace] text-xs break-all">
											{#if value === null || value === undefined}
												<span class="text-base-content/30 italic">null</span>
											{:else if Array.isArray(value)}
												{JSON.stringify(value)}
											{:else}
												{String(value)}
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
	</div>
</div>
