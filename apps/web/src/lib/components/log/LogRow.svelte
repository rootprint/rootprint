<script lang="ts">
  import type { LogHit, TimezoneMode } from '$lib/types';
  import { levelColor } from '$lib/constants/level-colors';
  import { formatLogRowTimestamp } from '$lib/utils/time';

  let {
    hit,
    timezoneMode,
    onclick = () => {},
  }: {
    hit: LogHit;
    timezoneMode: TimezoneMode;
    onclick?: () => void;
  } = $props();
</script>

<button
  type="button"
  class="grid w-full items-stretch border-b border-base-content/5 text-left font-mono text-xs hover:bg-base-200/60"
  style="grid-template-columns: 3px 200px 1fr;"
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
  <span class="px-3 py-1 whitespace-nowrap">{hit.message}</span>
</button>
