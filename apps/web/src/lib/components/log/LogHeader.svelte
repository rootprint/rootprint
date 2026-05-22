<script lang="ts">
  import { ArrowDown, ArrowUp } from 'lucide-svelte';
  import type { FieldConfig, SortDirection } from '$lib/types';
  import { buildGridTemplate } from '$lib/utils/column-width';

  let {
    fieldConfig,
    columns,
    columnWidths,
    sortDirection,
    ontogglesort = () => {},
  }: {
    fieldConfig: FieldConfig | null;
    columns: string[];
    columnWidths: Record<string, number>;
    sortDirection: SortDirection;
    ontogglesort?: () => void;
  } = $props();

  let timestampLabel = $derived(fieldConfig?.timestampField ?? 'timestamp');
  let messageLabel = $derived(fieldConfig?.messageField ?? 'message');

  let gridTemplate = $derived(buildGridTemplate(columns, columnWidths));
</script>

<div
  class="sticky top-0 z-10 grid items-center border-b border-base-content/10 bg-base-300 font-mono text-xs tracking-wider text-base-content/60"
  style="grid-template-columns: {gridTemplate};"
>
  <span aria-hidden="true"></span>
  <button
    type="button"
    class="flex items-center gap-1 px-3 py-1.5 text-left hover:text-base-content"
    onclick={ontogglesort}
  >
    {timestampLabel}
    {#if sortDirection === 'desc'}
      <ArrowDown class="h-3 w-3" />
    {:else}
      <ArrowUp class="h-3 w-3" />
    {/if}
  </button>
  {#each columns as column (column)}
    <span class="truncate px-3 py-1.5" title={column}>{column}</span>
  {/each}
  <span class="px-3 py-1.5">{messageLabel}</span>
</div>
