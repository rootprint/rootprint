<script lang="ts">
  import { ArrowDown, ArrowUp } from 'lucide-svelte';
  import type { SortDirection } from '$lib/types';

  let {
    sortDirection,
    ontogglesort = () => {}
  }: {
    sortDirection: SortDirection;
    ontogglesort?: () => void;
  } = $props();
</script>

<div
  class="sticky top-0 z-10 grid items-center gap-3 border-b border-base-content/10 bg-base-100 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-base-content/50"
  style="grid-template-columns: 180px 56px 1fr;"
>
  <button
    type="button"
    class="flex items-center gap-1 text-left hover:text-base-content"
    onclick={ontogglesort}
  >
    timestamp
    {#if sortDirection === 'desc'}
      <ArrowDown class="h-3 w-3" />
    {:else}
      <ArrowUp class="h-3 w-3" />
    {/if}
  </button>
  <span>level</span>
  <span>message</span>
</div>
