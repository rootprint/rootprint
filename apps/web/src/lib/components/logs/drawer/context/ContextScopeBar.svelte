<script lang="ts">
	import { Search } from 'lucide-svelte';

	import ToggleChip from '#lib/components/ui/ToggleChip.svelte';
	import { pluralize } from '#lib/utils/format.js';
	import type { ContextScope, ScopeField } from '#lib/components/logs/context-scope.js';

	let {
		selected,
		scopes,
		fields,
		matches,
		onChange,
		onToggleField,
		onOpenAsSearch
	}: {
		selected: ContextScope;
		scopes: ContextScope[];
		fields: ScopeField[];
		/** The fields the selected scope matches on. */
		matches: ScopeField[];
		onChange: (scope: ContextScope) => void;
		onToggleField: (field: string) => void;
		onOpenAsSearch: () => void;
	} = $props();

	const LABELS: Record<ContextScope, string> = {
		all: 'All',
		service: 'Service',
		instance: 'Instance',
		pod: 'Pod',
		node: 'Node',
		host: 'Host',
		container: 'Container',
		custom: 'Custom'
	};
</script>

<div class="border-line bg-base-100 border-b">
	<div class="flex items-center gap-2 px-3 py-2">
		<span class="text-muted shrink-0 text-xs">Scope</span>

		<div class="join" role="group" aria-label="Context scope">
			{#each scopes as scope (scope)}
				<button
					type="button"
					class={['btn join-item btn-xs', selected === scope && 'btn-neutral']}
					aria-pressed={selected === scope}
					onclick={() => onChange(scope)}
				>
					{LABELS[scope]}
				</button>
			{/each}
		</div>

		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square ml-auto"
			title="Open in search"
			aria-label="Open in search"
			onclick={onOpenAsSearch}
		>
			<Search class="size-3" aria-hidden="true" />
		</button>
	</div>

	{#if selected === 'custom'}
		<div class="px-3 pb-2">
			<p class="text-muted mb-1.5 text-xs">
				Matching {pluralize(matches.length, 'field')}
			</p>
			<div
				class="flex max-h-30 flex-wrap gap-1.5 overflow-y-auto"
				role="group"
				aria-label="Fields to match"
			>
				{#each fields as scopeField (scopeField.field)}
					<ToggleChip
						pressed={matches.includes(scopeField)}
						class="max-w-full gap-1 font-mono"
						title="{scopeField.field} = {scopeField.value}"
						onclick={() => onToggleField(scopeField.field)}
					>
						<span class="truncate">{scopeField.label}</span>
						<span aria-hidden="true">=</span>
						<span class="max-w-48 truncate">{scopeField.value}</span>
					</ToggleChip>
				{/each}
			</div>
		</div>
	{/if}
</div>
