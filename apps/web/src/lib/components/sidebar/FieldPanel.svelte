<script lang="ts">
  import { ChevronDown, ChevronRight, Search } from 'lucide-svelte';
  import type { LevelBucket, LogField, LogFieldValueBucket } from '$lib/types';
  import { isOtelAttr, isOtelResourceAttr } from '$lib/utils/fields';
  import { severityDotClass, sortBySeverity } from '$lib/utils/log-helpers';

  import FieldRow from './FieldRow.svelte';

  let {
    levels,
    fields,
    isOtelIndex,
    fieldValues
  }: {
    levels: LevelBucket[];
    fields: LogField[];
    isOtelIndex: boolean;
    fieldValues: Record<string, LogFieldValueBucket[]>;
  } = $props();

  type GroupKey = 'top' | 'attributes' | 'resource_attributes';
  type FieldGroup = { key: GroupKey; label: string; fields: LogField[] };

  let searchTerm = $state('');
  let inputEl: HTMLInputElement | null = $state(null);
  let groupsCollapsed = $state<Record<'attributes' | 'resource_attributes', boolean>>({
    attributes: false,
    resource_attributes: false
  });

  let normalized = $derived(searchTerm.trim().toLowerCase());

  let filteredLevels = $derived(
    normalized
      ? levels.filter((l) => l.name.toLowerCase().includes(normalized))
      : levels
  );

  let sortedLevels = $derived.by(() => {
    const order = sortBySeverity(filteredLevels.map((l) => l.name));
    const byName = new Map(filteredLevels.map((l) => [l.name, l]));
    const result: LevelBucket[] = [];
    for (const n of order) {
      const v = byName.get(n);
      if (v) result.push(v);
    }
    return result;
  });

  let groups = $derived.by<FieldGroup[]>(() => {
    const matching = normalized
      ? fields.filter((f) => f.displayName.toLowerCase().includes(normalized))
      : fields;

    if (!isOtelIndex) {
      return [{ key: 'top', label: '', fields: matching }];
    }

    const top: LogField[] = [];
    const attrs: LogField[] = [];
    const resourceAttrs: LogField[] = [];
    for (const f of matching) {
      if (isOtelResourceAttr(f.name)) resourceAttrs.push(f);
      else if (isOtelAttr(f.name)) attrs.push(f);
      else top.push(f);
    }
    return [
      { key: 'top', label: '', fields: top },
      { key: 'attributes', label: 'Attributes', fields: attrs },
      { key: 'resource_attributes', label: 'Resource Attributes', fields: resourceAttrs }
    ];
  });

  let totalFieldMatches = $derived(groups.reduce((sum, g) => sum + g.fields.length, 0));
  let matchCount = $derived(filteredLevels.length + totalFieldMatches);
  let isAllEmpty = $derived(normalized.length > 0 && matchCount === 0);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      searchTerm = '';
      inputEl?.blur();
    }
  }

  function toggleGroup(key: 'attributes' | 'resource_attributes') {
    groupsCollapsed[key] = !groupsCollapsed[key];
  }
</script>

<div class="flex h-full flex-col bg-base-100">
  <!-- Sticky global name-search header -->
  <div class="sticky top-0 z-10 border-b border-base-content/10 bg-base-100 p-3">
    <label class="input input-sm w-full gap-2">
      <Search class="h-3.5 w-3.5 text-base-content/50" />
      <input
        type="text"
        placeholder="Filter fields…"
        aria-label="Filter fields"
        bind:this={inputEl}
        bind:value={searchTerm}
        onkeydown={handleKeydown}
      />
    </label>
    {#if normalized && !isAllEmpty}
      <p class="mt-1.5 font-mono text-xs text-base-content/50">
        {matchCount} {matchCount === 1 ? 'match' : 'matches'}
      </p>
    {/if}
  </div>

  <!-- Body — native scroll -->
  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if isAllEmpty}
      <p class="p-6 text-center font-mono text-xs text-base-content/50">No matches</p>
    {:else}
      {#if sortedLevels.length > 0}
        <section class="p-3">
          <p class="eyebrow mb-2">Levels</p>
          <ul class="space-y-0.5">
            {#each sortedLevels as level (level.name)}
              <li class="flex items-center gap-2 px-1.5 font-mono text-xs">
                <span
                  class="h-2 w-2 shrink-0 rounded-full {severityDotClass(
                    level.name.toLowerCase()
                  )}"
                ></span>
                <span class="min-w-0 flex-1 truncate">{level.name}</span>
                <span class="w-12 shrink-0 text-right text-base-content/50 tabular-nums">
                  {level.count.toLocaleString()}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#each groups as group (group.key)}
        {#if group.fields.length > 0}
          {#if group.label}
            {@const isCollapsed =
              groupsCollapsed[group.key as 'attributes' | 'resource_attributes']}
            <button
              type="button"
              class="flex w-full items-center gap-1 border-b border-base-content/10 px-3 py-1.5"
              aria-expanded={!isCollapsed}
              onclick={() =>
                toggleGroup(group.key as 'attributes' | 'resource_attributes')}
            >
              {#if isCollapsed}
                <ChevronRight class="h-3 w-3 shrink-0 text-base-content/60" />
              {:else}
                <ChevronDown class="h-3 w-3 shrink-0 text-base-content/60" />
              {/if}
              <span class="flex-1 text-left text-xs font-medium">{group.label}</span>
              <span class="text-[10px] text-base-content/40">({group.fields.length})</span>
            </button>
            {#if !isCollapsed}
              {#each group.fields as field (field.name)}
                <FieldRow
                  {field}
                  values={fieldValues[field.name] ?? []}
                  indented
                />
              {/each}
            {/if}
          {:else}
            {#each group.fields as field (field.name)}
              <FieldRow {field} values={fieldValues[field.name] ?? []} />
            {/each}
          {/if}
        {/if}
      {/each}
    {/if}
  </div>
</div>
