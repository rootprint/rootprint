<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';

	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	import CreateTokenModal from './CreateTokenModal.svelte';

	let open = $state(false);
</script>

<div
	class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
>
	<AlertTriangle size={18} class="mt-0.5 shrink-0 text-warning" />
	<div class="flex-1">
		<p>You need an ingest token before you can send logs.</p>
		<button type="button" class="btn mt-2 btn-sm btn-neutral" onclick={() => (open = true)}>
			Create a token →
		</button>
	</div>
</div>

<CreateTokenModal bind:open indexIds={[DEFAULT_OTEL_LOGS_INDEX_ID]} />
