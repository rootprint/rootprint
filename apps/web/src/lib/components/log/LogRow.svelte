<script lang="ts">
  import type { LogHit, TimezoneMode, WrapMode } from '$lib/types';

  let {
    hit,
    wrapMode,
    timezoneMode,
    onclick = () => {}
  }: {
    hit: LogHit;
    wrapMode: WrapMode;
    timezoneMode: TimezoneMode;
    onclick?: () => void;
  } = $props();

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    if (timezoneMode === 'utc') {
      return d.toISOString().replace('T', ' ').replace('Z', '');
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds()) +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
  }

  const levelClass: Record<string, string> = {
    error: 'text-error',
    warn: 'text-warning',
    info: 'text-info'
  };
</script>

<button
  type="button"
  class="grid w-full items-start gap-3 border-b border-base-content/5 px-3 py-1 text-left font-mono text-xs hover:bg-base-200/60"
  style="grid-template-columns: 180px 56px 1fr;"
  onclick={onclick}
>
  <span class="text-base-content/60">{formatTimestamp(hit.timestamp)}</span>
  <span class={levelClass[hit.level] ?? 'text-base-content/60'}>{hit.level.toUpperCase()}</span>
  <span
    class={wrapMode === 'truncate'
      ? 'truncate'
      : wrapMode === 'wrap'
        ? 'whitespace-pre-wrap break-words'
        : 'whitespace-nowrap'}
  >
    {hit.message}
  </span>
</button>
