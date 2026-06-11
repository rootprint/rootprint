<script lang="ts">
	import type { ApiKeyRole } from 'api/types';

	let { role }: { role: ApiKeyRole } = $props();

	const label = $derived(role === 'ingest' ? 'Ingest' : 'Search');
</script>

<span class="badge badge-sm badge-soft badge-neutral text-[10px] tracking-wide uppercase">
	{label}
</span>
