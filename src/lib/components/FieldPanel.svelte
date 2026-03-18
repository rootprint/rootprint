<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import Icon from '@iconify/svelte';
	import type { IndexField } from '$lib/types';

	let {
		availableFields,
		activeFields = $bindable(),
		onchange,
		loading = false
	}: {
		availableFields: IndexField[];
		activeFields: string[];
		onchange?: (fields: string[]) => void;
		loading?: boolean;
	} = $props();

	let collapsed = $state(false);
	let configMode = $state(false);

	let dndItems = $state<{ id: string; name: string }[]>([]);

	$effect(() => {
		dndItems = activeFields.map((name) => ({ id: name, name }));
	});

	let filteredAvailable = $derived(availableFields.filter((f) => !activeFields.includes(f.name)));

	function handleDndConsider(e: CustomEvent<{ items: typeof dndItems }>) {
		dndItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: typeof dndItems }>) {
		dndItems = e.detail.items;
		activeFields = dndItems.map((f) => f.name);
		onchange?.(activeFields);
	}

	function addField(name: string) {
		activeFields = [...activeFields, name];
		onchange?.(activeFields);
	}

	function removeField(name: string) {
		activeFields = activeFields.filter((f) => f !== name);
		onchange?.(activeFields);
	}
</script>

<div class="flex flex-col bg-base-100">
	<div class="flex items-center border-b border-base-300 px-3 py-2">
		<button class="flex flex-1 items-center" onclick={() => (collapsed = !collapsed)}>
			<Icon
				icon={collapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'}
				width="14"
				height="14"
				class="mr-1 text-base-content/60"
			/>
			<h3
				class="flex-1 text-left text-xs font-semibold tracking-wider text-base-content/80 uppercase"
			>
				Fields
			</h3>
		</button>
		{#if availableFields.length > 0}
			<button
				class="btn ml-1 p-0 btn-ghost btn-xs"
				onclick={() => {
					if (!configMode) collapsed = false;
					configMode = !configMode;
				}}
				title={configMode ? 'Done configuring' : 'Configure display fields'}
			>
				<Icon
					icon={configMode ? 'lucide:check' : 'lucide:settings'}
					width="14"
					height="14"
					class="text-base-content/60"
				/>
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else if !collapsed}
		{#if activeFields.length === 0 && !configMode}
			<div class="px-3 py-3">
				<p class="text-[11px] text-base-content/50">Click the gear icon to add display fields</p>
			</div>
		{:else}
			<div class="flex flex-col">
				<div class="{configMode ? 'border-b border-base-300' : ''} p-2">
					{#if configMode}
						<p class="mb-1 text-xs font-medium text-base-content/50">Active</p>
					{/if}
					{#if dndItems.length === 0}
						<p class="px-1 py-2 text-xs text-base-content/50">No extra fields</p>
					{:else}
						<div
							use:dndzone={{ items: dndItems, flipDurationMs: 150, type: 'active-fields' }}
							onconsider={handleDndConsider}
							onfinalize={handleDndFinalize}
							class="flex flex-col gap-1"
						>
							{#each dndItems as field (field.id)}
								<div class="flex items-center gap-1 rounded bg-base-200 px-2 py-1 text-xs">
									<Icon
										icon="lucide:grip-vertical"
										width="12"
										height="12"
										class="shrink-0 cursor-grab text-base-content/60"
									/>
									<span class="flex-1 truncate">{field.name}</span>
									{#if configMode}
										<button
											class="btn p-0 btn-ghost btn-xs"
											onclick={() => removeField(field.name)}
										>
											<Icon icon="lucide:x" width="12" height="12" />
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>

				{#if configMode && filteredAvailable.length > 0}
					<div class="flex-1 p-2">
						<p class="mb-1 text-xs font-medium text-base-content/50">Available</p>
						<div class="flex flex-col gap-0.5">
							{#each filteredAvailable as field (field.name)}
								<button
									class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-base-200"
									onclick={() => addField(field.name)}
								>
									<Icon
										icon="lucide:plus"
										width="12"
										height="12"
										class="shrink-0 text-base-content/60"
									/>
									<span class="truncate">{field.name}</span>
									<span class="ml-auto text-[10px] text-base-content/50">{field.type}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
