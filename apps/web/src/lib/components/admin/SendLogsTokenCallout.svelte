<script lang="ts">
	import Callout from '$lib/components/ui/Callout.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	import CreateTokenModal from './CreateTokenModal.svelte';

	let open = $state(false);
</script>

<Callout variant="warning">
	<p>You need an ingest token before you can send logs.</p>
	<button type="button" class="btn mt-2 btn-sm btn-neutral" onclick={() => (open = true)}>
		Create a token →
	</button>
</Callout>

<CreateTokenModal bind:open indexIds={[DEFAULT_OTEL_LOGS_INDEX_ID]} />
