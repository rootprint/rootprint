<script lang="ts">
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import type { LogField, LogFieldValueBucket } from '$lib/types';

  let {
    field,
    values,
    indented = false
  }: {
    field: LogField;
    values: LogFieldValueBucket[];
    indented?: boolean;
  } = $props();

  const INITIAL_SHOW_COUNT = 10;
  const PAGE_SIZE = 100;

  let open = $state(false);
  let valueSearch = $state('');
  let showCount = $state(INITIAL_SHOW_COUNT);

  let normalizedValueSearch = $derived(valueSearch.trim().toLowerCase());

  let filteredValues = $derived(
    normalizedValueSearch
      ? values.filter((b) => b.value.toLowerCase().includes(normalizedValueSearch))
      : values
  );

  let visibleValues = $derived(
    normalizedValueSearch ? filteredValues : filteredValues.slice(0, showCount)
  );

  let remaining = $derived(
    normalizedValueSearch ? 0 : Math.max(0, filteredValues.length - showCount)
  );

  let countLabel = $derived(values.length > 0 ? `(${values.length})` : '');

  function toggle() {
    open = !open;
    if (!open) {
      valueSearch = '';
      showCount = INITIAL_SHOW_COUNT;
    }
  }

  function showMore() {
    showCount += PAGE_SIZE;
  }

  function showLess() {
    showCount = INITIAL_SHOW_COUNT;
  }
</script>

<div class="border-b border-base-content/10">
  <button
    type="button"
    class="flex w-full items-center gap-1 py-1.5 {indented ? 'pr-3 pl-6' : 'px-3'}"
    aria-expanded={open}
    onclick={toggle}
  >
    {#if open}
      <ChevronDown class="h-3 w-3 shrink-0 text-base-content/60" />
    {:else}
      <ChevronRight class="h-3 w-3 shrink-0 text-base-content/60" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-left text-xs" title={field.name}>
      {field.displayName}
    </span>
    {#if countLabel}
      <span class="text-[10px] text-base-content/40">{countLabel}</span>
    {/if}
  </button>

  {#if open}
    <div class="pb-3 {indented ? 'pr-3 pl-6' : 'px-3'}">
      {#if values.length > INITIAL_SHOW_COUNT}
        <input
          type="text"
          class="input input-xs mb-2 w-full"
          placeholder="Search values…"
          aria-label="Filter values"
          bind:value={valueSearch}
        />
      {/if}

      {#if visibleValues.length === 0}
        <p class="py-1 text-xs text-base-content/50">
          {normalizedValueSearch ? 'No matching values' : 'No values found'}
        </p>
      {:else}
        <ul class="flex flex-col gap-0.5">
          {#each visibleValues as bucket (bucket.value)}
            <li class="flex items-center gap-2 px-1.5 font-mono text-xs">
              <span class="min-w-0 flex-1 truncate">{bucket.value}</span>
              <span
                class="w-12 shrink-0 text-right text-[10px] text-base-content/50 tabular-nums"
              >
                {bucket.count.toLocaleString()}
              </span>
            </li>
          {/each}
        </ul>

        {#if !normalizedValueSearch && remaining > 0}
          <button
            type="button"
            class="mt-1 text-xs text-primary hover:underline"
            onclick={showMore}
          >
            Show more ({remaining})
          </button>
        {:else if !normalizedValueSearch && showCount > INITIAL_SHOW_COUNT && values.length > INITIAL_SHOW_COUNT}
          <button
            type="button"
            class="mt-1 text-xs text-primary hover:underline"
            onclick={showLess}
          >
            Show less
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>
