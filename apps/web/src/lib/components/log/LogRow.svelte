<script lang="ts">
  import type { LogHit, TimezoneMode } from '$lib/types';
  import { levelColor } from '$lib/constants/level-colors';
  import { formatLogRowTimestamp } from '$lib/utils/time';
  import { getByPath } from '$lib/utils/get-by-path';
  import { formatCell } from '$lib/utils/column-width';

  let {
    hit,
    columns,
    gridTemplate,
    timezoneMode,
    onclick = () => {},
  }: {
    hit: LogHit;
    columns: string[];
    gridTemplate: string;
    timezoneMode: TimezoneMode;
    onclick?: () => void;
  } = $props();
</script>

<button
  type="button"
  class="grid w-full items-stretch border-b border-base-content/5 text-left font-mono text-xs hover:bg-base-200/60"
  style="grid-template-columns: {gridTemplate};"
  onclick={onclick}
>
  <span
    aria-hidden="true"
    title={hit.level.toUpperCase()}
    style="background-color: {levelColor(hit.level)};"
  ></span>
  <span class="px-3 py-1 text-base-content/60">
    {formatLogRowTimestamp(hit.timestamp, timezoneMode)}
  </span>
  {#each columns as column (column)}
    <span class="truncate whitespace-nowrap px-3 py-1" title={column}>
      {formatCell(getByPath(hit.raw, column))}
    </span>
  {/each}
  <span class="px-3 py-1 whitespace-nowrap">{hit.message}</span>
</button>
