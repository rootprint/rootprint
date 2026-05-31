<script lang="ts">
	import type { ApiKeyRole } from 'api/types';

	let { role }: { role: ApiKeyRole } = $props();

	const label = $derived(role === 'ingest' ? 'Ingest' : 'Search');
	const cls = $derived(
		role === 'ingest' ? 'badge-soft badge-primary' : 'badge-soft badge-secondary'
	);
</script>

<span class="badge badge-sm text-[10px] tracking-wide uppercase {cls}">
	{label}
</span>
