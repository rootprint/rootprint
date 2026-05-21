<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { FieldConfig, LogHit, TimezoneMode } from '$lib/types';

  let {
    open = $bindable(false),
    hit,
    selectedIndex,
    fieldConfig,
    timezoneMode
  }: {
    open?: boolean;
    hit: LogHit | null;
    selectedIndex: string;
    fieldConfig: FieldConfig;
    timezoneMode: TimezoneMode;
  } = $props();

  function close() {
    open = false;
  }
</script>

{#if open && hit}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-base-content/30"
    aria-label="Close detail"
    onclick={close}
  ></button>

  <aside
    class="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-base-content/10 bg-base-100"
    aria-label="Log detail"
  >
    <header
      class="flex items-center justify-between border-b border-base-content/10 px-3 py-2"
    >
      <div class="flex flex-col">
        <span class="font-mono text-[10px] uppercase tracking-wider text-base-content/50">
          {selectedIndex} · {timezoneMode === 'utc' ? 'UTC' : 'local'}
        </span>
        <span class="font-mono text-xs">{hit.timestamp}</span>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square"
        aria-label="Close"
        onclick={close}
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-auto p-3">
      <p class="eyebrow mb-2">Message</p>
      <p class="mb-4 font-mono text-xs">{hit.message}</p>

      <p class="eyebrow mb-2">Raw</p>
      <pre class="hairline rounded p-3 font-mono text-xs leading-relaxed"
><code>{JSON.stringify(hit.raw, null, 2)}</code></pre>

      <!-- TODO(store): traceback parsing, context view, share link -->
    </div>

    <footer
      class="border-t border-base-content/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-base-content/40"
    >
      fields: {fieldConfig.timestampField} · {fieldConfig.levelField} · {fieldConfig.messageField}
    </footer>
  </aside>
{/if}
