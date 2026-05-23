<script lang="ts">
  import { Copy, Minus, Plus } from 'lucide-svelte';
  import HighlightedText from './HighlightedText.svelte';
  import type { DrawerField } from '$lib/utils/hit-fields';

  let {
    field,
    searchTerm = '',
    onFilterFor,
    onFilterOut,
    onCopy,
  }: {
    field: DrawerField;
    searchTerm?: string;
    onFilterFor: (field: DrawerField) => void;
    onFilterOut: (field: DrawerField) => void;
    onCopy: (field: DrawerField) => void;
  } = $props();
</script>

<tr class="group border-b border-base-content/10 align-top">
  <td
    class="w-56 max-w-[14rem] truncate border-r border-base-content/10 px-3 py-1.5 font-mono text-xs text-base-content/70"
    title={field.name}
  >
    <HighlightedText text={field.name} term={searchTerm} />
  </td>
  <td class="relative px-3 py-1.5 font-mono text-xs text-base-content">
    {#if field.isEmpty}
      <span class="text-base-content/30">—</span>
    {:else}
      <span class="break-words whitespace-pre-wrap"
        ><HighlightedText text={field.value} term={searchTerm} /></span
      >
      <span
        class="absolute right-2 top-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square bg-base-100"
          aria-label="Filter for value"
          title="Filter for value"
          onclick={(e) => {
            onFilterFor(field);
            e.currentTarget.blur();
          }}
        >
          <Plus class="h-3 w-3" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square bg-base-100"
          aria-label="Filter out value"
          title="Filter out value"
          onclick={(e) => {
            onFilterOut(field);
            e.currentTarget.blur();
          }}
        >
          <Minus class="h-3 w-3" />
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs btn-square bg-base-100"
          aria-label="Copy value"
          title="Copy value"
          onclick={(e) => {
            onCopy(field);
            e.currentTarget.blur();
          }}
        >
          <Copy class="h-3 w-3" />
        </button>
      </span>
    {/if}
  </td>
</tr>
