<script lang="ts">
	import type { AdminIndexField } from '$lib/types';

	let { fields }: { fields: AdminIndexField[] } = $props();
</script>

<table class="table table-sm">
	<thead class="sticky top-0 bg-base-100">
		<tr>
			<th>Name</th>
			<th>Type</th>
			<th>Fast</th>
			<th>Indexed</th>
			<th>Stored</th>
			<th>Record</th>
			<th>Tokenizer</th>
		</tr>
	</thead>
	<tbody>
		{#each fields as field (field.name)}
			<tr class="group hover:bg-base-200">
				<td>
					<div class="font-medium">{field.name}</div>
					{#if field.description}
						<div class="text-[10px] text-base-content/60">
							{field.description}
						</div>
					{/if}
				</td>
				<td>
					<span class="badge badge-sm">{field.type}</span>
				</td>
				<td>
					{#if field.fast}
						<span class="text-success">✓</span>
					{:else}
						<span class="text-base-content/50">—</span>
					{/if}
				</td>
				<td>
					{#if field.indexed}
						<span class="text-success">✓</span>
					{:else}
						<span class="text-base-content/50">—</span>
					{/if}
				</td>
				<td>
					{#if field.stored}
						<span class="text-success">✓</span>
					{:else}
						<span class="text-base-content/50">—</span>
					{/if}
				</td>
				<td class="text-base-content/60">{field.record ?? '—'}</td>
				<td class="text-base-content/60">{field.tokenizer ?? '—'}</td>
			</tr>
		{/each}
	</tbody>
</table>
