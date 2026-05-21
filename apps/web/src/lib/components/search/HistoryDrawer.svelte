<script lang="ts">
  import { X } from 'lucide-svelte';
  import type { DrawerTab } from '$lib/types';

  let {
    drawerTab = $bindable<DrawerTab | null>(null),
    history,
    savedQueries,
    sharedQueries,
    onrestore = () => {}
  }: {
    drawerTab?: DrawerTab | null;
    history: unknown[];
    savedQueries: unknown[];
    sharedQueries: unknown[];
    onrestore?: (params: unknown) => void;
  } = $props();

  function close() {
    drawerTab = null;
  }

  const tabs: { id: DrawerTab; label: string; count: number }[] = $derived([
    { id: 'history', label: 'History', count: history.length },
    { id: 'saved', label: 'Saved', count: savedQueries.length },
    { id: 'shared', label: 'Shared', count: sharedQueries.length }
  ]);
</script>

{#if drawerTab !== null}
  <aside
    class="border-t border-base-content/10 bg-base-100"
    style="height: 260px;"
    aria-label="History drawer"
  >
    <header
      class="flex items-center gap-1 border-b border-base-content/10 px-2 py-1"
    >
      {#each tabs as tab (tab.id)}
        <button
          type="button"
          class="rounded px-2 py-1 font-mono text-xs {drawerTab === tab.id
            ? 'bg-base-200 text-base-content'
            : 'text-base-content/60 hover:text-base-content'}"
          onclick={() => (drawerTab = tab.id)}
        >
          {tab.label}
          <span class="ml-1 text-base-content/40">{tab.count}</span>
        </button>
      {/each}

      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square ml-auto"
        aria-label="Close"
        onclick={close}
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </header>

    <div class="flex h-full items-center justify-center font-mono text-xs text-base-content/50">
      <!-- TODO(store): render history / saved / shared lists, onrestore handler -->
      {#if drawerTab === 'history'}No history yet.
      {:else if drawerTab === 'saved'}No saved queries yet.
      {:else}No shared queries yet.
      {/if}
    </div>
  </aside>
{/if}
