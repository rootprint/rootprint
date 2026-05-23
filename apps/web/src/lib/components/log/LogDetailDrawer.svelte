<script lang="ts">
  import { toast } from 'svelte-sonner';

  import DrawerHeader, { type DrawerTab } from './drawer/DrawerHeader.svelte';
  import DrawerSearchBox from './drawer/DrawerSearchBox.svelte';
  import JsonPane from './drawer/JsonPane.svelte';
  import ParametersPane from './drawer/ParametersPane.svelte';
  import { createShare } from '$lib/api/shares';
  import { ApiError } from '$lib/api/errors';
  import { copyWithToast } from '$lib/utils/clipboard';
  import type { LogHit } from '$lib/types';
  import type { SearchStore } from '$lib/stores/search.svelte';

  const MAX_HIT_BYTES = 60 * 1024;

  let {
    hit,
    onClose,
    store,
  }: {
    hit: LogHit | null;
    onClose: () => void;
    store: SearchStore;
  } = $props();

  let activeTab = $state<DrawerTab>('parameters');
  let searchOpen = $state(false);
  let searchTerm = $state('');
  let sharing = $state(false);
  let dialogRef: HTMLDivElement | null = $state(null);
  let previousFocus: HTMLElement | null = null;

  // Reset transient state when the drawer opens for a new hit.
  $effect(() => {
    if (hit) {
      activeTab = 'parameters';
      searchOpen = false;
      searchTerm = '';
      previousFocus = document.activeElement as HTMLElement | null;
      queueMicrotask(() => dialogRef?.focus());
    }
  });

  function close() {
    onClose();
    queueMicrotask(() => previousFocus?.focus());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!hit) return;
    if (e.key === 'Escape') {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      close();
    }
  }

  async function shareLog() {
    if (!hit || !store.fieldConfig) return;
    const indexId = store.selectedIndex;
    const startTime = store.resolvedStartTs;
    const endTime = store.resolvedEndTs;
    if (indexId === null || startTime === undefined || endTime === undefined) {
      toast.error('Search context not ready');
      return;
    }
    const payloadSize = new TextEncoder().encode(JSON.stringify(hit.raw)).byteLength;
    if (payloadSize > MAX_HIT_BYTES) {
      toast.error('Log too large to share');
      return;
    }
    sharing = true;
    try {
      const { code } = await createShare({
        indexId,
        query: store.query,
        startTime,
        endTime,
        hit: hit.raw,
      });
      const url = `${window.location.origin}/s/${code}`;
      await copyWithToast(url, 'Share link copied', 'Failed to copy share link');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to create share';
      toast.error(msg);
    } finally {
      sharing = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if hit && store.fieldConfig}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-base-content/40"
    aria-label="Close detail"
    onclick={close}
  ></button>

  <div
    bind:this={dialogRef}
    tabindex={-1}
    class="fixed right-0 top-0 z-50 flex h-full w-1/2 max-w-full flex-col border-l border-base-content/10 bg-base-100 shadow-2xl outline-none"
    role="dialog"
    aria-modal="true"
    aria-label="Log detail"
  >
    <DrawerHeader
      {hit}
      timezoneMode={store.timezoneMode}
      {activeTab}
      {sharing}
      onTabChange={(t) => (activeTab = t)}
      onSearch={() => (searchOpen = !searchOpen)}
      onShare={shareLog}
      onClose={close}
    />

    {#if searchOpen}
      <DrawerSearchBox
        bind:value={searchTerm}
        onClose={() => {
          searchOpen = false;
          searchTerm = '';
        }}
      />
    {/if}

    <div class="min-h-0 flex-1" role="tabpanel" id={`drawer-panel-${activeTab}`} aria-labelledby={`drawer-tab-${activeTab}`}>
      {#if activeTab === 'parameters'}
        <ParametersPane {hit} {searchTerm} {store} />
      {:else}
        <JsonPane raw={hit.raw} />
      {/if}
    </div>
  </div>
{/if}
