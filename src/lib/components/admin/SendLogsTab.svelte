<script lang="ts">
	import IngestTokensCard from '$lib/components/admin/IngestTokensCard.svelte';
	import IngestTokensList from '$lib/components/admin/IngestTokensList.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import type { IngestTokenSummary } from '$lib/types';

	let {
		origin,
		ingestTokens,
		ingestIndexIds
	}: {
		origin: string;
		ingestTokens: IngestTokenSummary[];
		ingestIndexIds: string[];
	} = $props();

	let endpointUrl = $derived(`${origin}/api/ingest/{indexId}`);

	let curlExample = $derived(
		`curl -X POST ${origin}/api/ingest/my-index \\
  -H "Authorization: Bearer lwit_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from my app", "level": "info"}'`
	);
</script>

<div class="flex flex-col gap-6">
	<!-- Endpoint -->
	<div>
		<div class="mb-3">
			<h2 class="text-xl font-semibold">Endpoint</h2>
			<p class="text-sm text-base-content/60">Send logs to Logwiz via HTTP POST</p>
		</div>
		<div class="flex items-center gap-2">
			<code
				class="flex-1 rounded border border-base-300 bg-base-200/50 px-3 py-2 font-mono text-sm"
			>
				{endpointUrl}
			</code>
			<CopyButton text={endpointUrl} class="btn btn-ghost btn-sm" title="Copy endpoint URL" />
		</div>
	</div>

	<!-- Example Request -->
	<div>
		<div class="mb-3">
			<h2 class="text-xl font-semibold">Example Request</h2>
		</div>
		<div class="relative">
			<pre
				class="overflow-x-auto rounded-lg bg-neutral p-4 font-mono text-sm leading-relaxed text-neutral-content">{curlExample}</pre>
			<div class="absolute top-2 right-2">
				<CopyButton
					text={curlExample}
					class="btn text-neutral-content/70 btn-ghost btn-xs hover:text-neutral-content"
					title="Copy example"
				/>
			</div>
		</div>
	</div>

	<!-- Create Ingest Token -->
	<IngestTokensCard indexIds={ingestIndexIds} />

	<!-- Ingest Tokens List -->
	<IngestTokensList tokens={ingestTokens} />
</div>
