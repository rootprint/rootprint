<script lang="ts">
  import { ArrowDown, ArrowUp } from 'lucide-svelte';
  import type { FieldConfig, SortDirection } from '$lib/types';

  let {
    fieldConfig,
    sortDirection,
    ontogglesort = () => {},
  }: {
    fieldConfig: FieldConfig | null;
    sortDirection: SortDirection;
    ontogglesort?: () => void;
  } = $props();

  let timestampLabel = $derived(fieldConfig?.timestampField ?? 'timestamp');
  let messageLabel = $derived(fieldConfig?.messageField ?? 'message');
</script>

<div
  class="sticky top-0 z-10 grid items-center border-b border-base-content/10 bg-base-100 font-mono text-xs tracking-wider text-base-content/60"
  style="grid-template-columns: 3px 200px 1fr;"
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
  <span class="px-3 py-1.5">{messageLabel}</span>
</div>
