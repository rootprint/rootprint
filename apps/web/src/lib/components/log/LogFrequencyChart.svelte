<script lang="ts">
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import type { HistogramBucket, TimezoneMode } from '$lib/types';

  let {
    data,
    timezoneMode,
    loading = false,
    numHits,
    collapsed = $bindable(false),
    onbrush = () => {}
  }: {
    data: HistogramBucket[];
    timezoneMode: TimezoneMode;
    loading?: boolean;
    numHits: number;
    collapsed?: boolean;
    onbrush?: (startIso: string, endIso: string) => void;
  } = $props();

  let max = $derived(data.reduce((m, b) => Math.max(m, b.count), 1));
</script>

<div class="border-b border-base-content/10 bg-base-100">
  <button
    type="button"
    class="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs text-base-content/60 hover:text-base-content"
    onclick={() => (collapsed = !collapsed)}
  >
    {#if collapsed}
      <ChevronRight class="h-3 w-3" />
    {:else}
      <ChevronDown class="h-3 w-3" />
    {/if}
    <span>histogram</span>
    <span class="text-base-content/40">·</span>
    <span>{numHits.toLocaleString()} hits</span>
    <span class="text-base-content/40">·</span>
    <span>{timezoneMode === 'utc' ? 'UTC' : 'local'}</span>
  </button>

  {#if !collapsed}
    <div
      class="relative flex h-16 items-end gap-px px-3 pb-2"
      role="img"
      aria-label="Log frequency histogram"
    >
      {#if loading}
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="loading loading-spinner loading-xs"></span>
        </div>
      {:else}
        {#each data as bucket, i (i)}
          <button
            type="button"
            class="flex-1 bg-primary/60 transition-colors hover:bg-primary"
            style:height="{Math.max(2, (bucket.count / max) * 100)}%"
            aria-label="{bucket.timestamp} — {bucket.count} hits"
            onclick={() => onbrush(bucket.timestamp, bucket.timestamp)}
          ></button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
