<!--
  ActivityTable: generic table used by the admin activity pages.
  Each column either renders a string via `render` (inserted via {@html}, so callers
  MUST escape any user-controlled string they include) or a Svelte snippet via
  `cell` (preferred for rich content like UserIdentity).
-->
<script lang="ts" generics="T extends Record<string, unknown>">
	import type { Snippet } from 'svelte';

	type Column<T> = {
		key: string;
		label: string;
		render?: (row: T) => string | number | null;
		cell?: Snippet<[T]>;
		class?: string;
	};

	type Props<T> = {
		title: string;
		rows: T[];
		columns: Column<T>[];
		empty?: string;
		footer?: Snippet;
	};

	let { title, rows, columns, empty = 'Nothing to show.', footer }: Props<T> = $props();
</script>

<div class="border-line rounded-box flex flex-col overflow-hidden border">
	{#if title}
		<header class="px-4 pt-4 pb-3">
			<p class="eyebrow">{title}</p>
		</header>
	{/if}
	{#if rows.length === 0}
		<div class="text-base-content/40 flex h-24 items-center justify-center text-xs">
			{empty}
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table-zebra table w-full text-sm">
				<thead>
					<tr>
						{#each columns as col (col.key)}
							<th class="text-base-content/60 text-xs font-medium">{col.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i (i)}
						<tr>
							{#each columns as col (col.key)}
								<td class={col.class}>
									{#if col.cell}
										{@render col.cell(row)}
									{:else if col.render}
										{@html col.render(row) ?? '—'}
									{:else}
										—
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	{#if footer}
		<footer class="border-line border-t px-4 py-2">
			{@render footer()}
		</footer>
	{/if}
</div>
