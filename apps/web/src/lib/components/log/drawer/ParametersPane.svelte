<script lang="ts">
  import FieldRow from './FieldRow.svelte';
  import type { DrawerField } from '$lib/utils/hit-fields';
  import { groupHitFields } from '$lib/utils/hit-fields';
  import { copyWithToast } from '$lib/utils/clipboard';
  import type { LogHit } from '$lib/types';
  import type { SearchStore } from '$lib/stores/search.svelte';

  let {
    hit,
    searchTerm,
    store,
  }: {
    hit: LogHit;
    searchTerm: string;
    store: SearchStore;
  } = $props();

  let showEmpty = $state(false);

  const grouped = $derived.by(() => {
    const cfg = store.fieldConfig;
    if (!cfg) return { message: '', messageLabel: '', fields: [] };
    return groupHitFields(hit.raw, cfg);
  });

  const rows = $derived(
    showEmpty ? grouped.fields : grouped.fields.filter((f) => !f.isEmpty),
  );

  function quote(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  function applyFilter(field: DrawerField, negate: boolean) {
    const clause = `${negate ? 'NOT ' : ''}${field.name}:${quote(field.value)}`;
    const existing = store.query.trim();
    const next = existing ? `${existing} ${clause}` : clause;
    store.runQuery(next);
  }

  function copyValue(field: DrawerField) {
    void copyWithToast(field.value, 'Value copied');
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <!-- Message block -->
  <div class="border-b border-base-content/10 p-3">
    <p class="eyebrow mb-1.5">{grouped.messageLabel}</p>
    <div
      class="hairline rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
    >
      {#if grouped.message === ''}
        <span class="text-base-content/40">(no message)</span>
      {:else}
        {grouped.message}
      {/if}
    </div>
  </div>

  <!-- Toolbar -->
  <div class="flex items-center justify-between border-b border-base-content/10 px-3 py-2">
    <label class="flex cursor-pointer items-center gap-2 text-xs text-base-content/70">
      <input
        type="checkbox"
        class="checkbox checkbox-xs"
        bind:checked={showEmpty}
      />
      Show empty values
    </label>
    <span class="font-mono text-[10px] text-base-content/40">{rows.length} fields</span>
  </div>

  <!-- Table -->
  <div class="min-h-0 flex-1 overflow-auto">
    {#if rows.length === 0}
      <p class="p-6 text-center font-mono text-xs text-base-content/40">No fields to display</p>
    {:else}
      <table class="w-full border-collapse table-fixed">
        <tbody>
          {#each rows as field (field.name)}
            <FieldRow
              {field}
              {searchTerm}
              onFilterFor={(f) => applyFilter(f, false)}
              onFilterOut={(f) => applyFilter(f, true)}
              onCopy={copyValue}
            />
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
