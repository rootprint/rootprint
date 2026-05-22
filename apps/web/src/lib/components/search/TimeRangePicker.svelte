<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import {
    formatTimeRangeLabel,
    PRESET_OPTIONS,
    presetDurationSec,
    type Preset,
  } from '$lib/utils/time-range';
  import type { TimeRange } from '$lib/types';

  let {
    value,
    onChange,
  }: {
    value: TimeRange;
    onChange: (next: TimeRange) => void;
  } = $props();

  const label = $derived(formatTimeRangeLabel(value));

  let details = $state<HTMLDetailsElement | null>(null);

  function close() {
    if (details) details.open = false;
  }

  function selectPreset(preset: Preset) {
    onChange({ type: 'relative', preset });
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && details?.open) close();
  }

  type Draft = { start: number; end: number };

  let draft = $state<Draft>({ start: 0, end: 0 });

  function nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  function secToLocalInputValue(sec: number): string {
    const d = new Date(sec * 1000);
    // toISOString() returns UTC; the input wants local time as YYYY-MM-DDTHH:mm.
    const tzOffsetMs = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  }

  function localInputValueToSec(s: string): number {
    // new Date('YYYY-MM-DDTHH:mm') is interpreted as local time by the spec.
    const ms = new Date(s).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  }

  function seedDraft(v: TimeRange): Draft {
    if (v.type === 'absolute') return { start: v.start, end: v.end };
    const end = nowSec();
    const sec = presetDurationSec(v.preset) ?? 15 * 60;
    return { start: end - sec, end };
  }

  function onToggle() {
    if (details?.open) draft = seedDraft(value);
  }

  const isValid = $derived(
    Number.isFinite(draft.start) &&
      Number.isFinite(draft.end) &&
      draft.end > draft.start
  );

  function apply() {
    if (!isValid) return;
    onChange({ type: 'absolute', start: draft.start, end: draft.end });
    close();
  }

  function cancel() {
    close();
  }

  function onWindowClick(e: MouseEvent) {
    if (!details?.open) return;
    const target = e.target as Node | null;
    if (target && !details.contains(target)) close();
  }
</script>

<svelte:window onkeydown={onKeydown} onclick={onWindowClick} />

<details bind:this={details} ontoggle={onToggle} class="dropdown dropdown-end">
  <summary
    class="hairline flex h-8 cursor-pointer list-none select-none items-center gap-2 rounded bg-base-100 px-2 font-mono text-xs hover:bg-base-200 focus:outline-none"
  >
    <span>{label}</span>
    <ChevronDown class="h-3 w-3 opacity-60" />
  </summary>

  <div
    class="dropdown-content hairline rounded-box z-50 mt-1 flex bg-base-100"
  >
    <div class="flex w-28 flex-col border-r border-base-content/10 p-3">
      <p class="eyebrow mb-2">Ranges</p>
      {#each PRESET_OPTIONS as preset (preset)}
        {@const active = value.type === 'relative' && value.preset === preset}
        <button
          type="button"
          class="-mx-3 block px-3 py-1.5 text-left font-mono text-xs transition-colors {active
            ? 'bg-base-content text-base-100'
            : 'text-base-content hover:bg-base-200'}"
          onclick={() => selectPreset(preset)}
        >
          {preset}
        </button>
      {/each}
    </div>

    <div class="flex w-72 flex-col p-3">
      <p class="eyebrow mb-2">Absolute range</p>

      <p class="eyebrow mb-1">From</p>
      <input
        type="datetime-local"
        class="input input-sm input-bordered w-full font-mono"
        value={secToLocalInputValue(draft.start)}
        oninput={(e) => {
          const sec = localInputValueToSec((e.currentTarget as HTMLInputElement).value);
          draft = { ...draft, start: sec };
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter') apply();
        }}
      />

      <p class="eyebrow mt-2 mb-1">To</p>
      <input
        type="datetime-local"
        class="input input-sm input-bordered w-full font-mono"
        value={secToLocalInputValue(draft.end)}
        oninput={(e) => {
          const sec = localInputValueToSec((e.currentTarget as HTMLInputElement).value);
          draft = { ...draft, end: sec };
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter') apply();
        }}
      />

      <div class="mt-auto flex justify-end gap-2 pt-3">
        <button type="button" class="btn btn-ghost btn-sm" onclick={cancel}>Cancel</button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          disabled={!isValid}
          onclick={apply}
        >
          Apply
        </button>
      </div>
    </div>
  </div>
</details>
