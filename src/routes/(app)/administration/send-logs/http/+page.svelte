<script lang="ts">
	import { AlertTriangle, Search } from 'lucide-svelte';

	import CreateTokenModal from '$lib/components/admin/CreateTokenModal.svelte';
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';

	let { data } = $props();

	let createTokenOpen = $state(false);

	function onIndexChange(event: Event & { currentTarget: HTMLSelectElement }) {
		event.currentTarget.form?.requestSubmit();
	}
</script>

<SendLogsSourceShell title="HTTP" docHref="https://docs.logwiz.io/send-logs/http">
	<p class="text-sm text-base-content/70">
		Logwiz is an authenticated NDJSON gateway in front of Quickwit. Use this to push logs to any
		index you own, in whatever shape that index's schema expects.
	</p>

	{#if !data.selectedIndexId}
		<Callout variant="warning">
			<p>
				No indexes are available to you. Create an index first, then come back to generate an ingest
				token and snippet.
			</p>
		</Callout>
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Pick your index</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Each ingest token is scoped to a single index. Select the index you want to write to —
						the snippet below is regenerated for that index and its most recent token.
					</p>
				</div>
				<form method="GET" class="max-w-xs">
					<label class="floating-label">
						<span>Index</span>
						<select
							name="index"
							class="select w-full select-md"
							value={data.selectedIndexId}
							onchange={onIndexChange}
						>
							{#each data.accessibleIndexIds as id (id)}
								<option value={id}>{id}</option>
							{/each}
						</select>
					</label>
				</form>
			</SendLogsStep>

			{#if !data.token || !data.snippets || !data.endpointUrl}
				<SendLogsStep number={2} isLast>
					<div
						class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
					>
						<AlertTriangle size={18} class="mt-0.5 shrink-0 text-warning" />
						<div class="flex-1">
							<p>
								No ingest token exists for <InlineCode>{data.selectedIndexId}</InlineCode>. Create
								one before you can send logs.
							</p>
							<button
								type="button"
								class="btn mt-2 btn-sm btn-neutral"
								onclick={() => (createTokenOpen = true)}
							>
								Create a token →
							</button>
						</div>
					</div>
				</SendLogsStep>

				<CreateTokenModal bind:open={createTokenOpen} indexIds={[data.selectedIndexId]} />
			{:else}
				<SendLogsStep number={2}>
					<div>
						<h3 class="font-semibold">Endpoint</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Pre-built for <InlineCode>{data.selectedIndexId}</InlineCode> with your most recent token
							embedded in the snippet below.
						</p>
					</div>
					<div class="flex items-center gap-2">
						<code
							class="flex-1 rounded border border-base-300 bg-base-200/50 px-3 py-2 font-mono text-sm"
						>
							{data.endpointUrl}
						</code>
						<CopyButton
							text={data.endpointUrl}
							class="btn btn-ghost btn-sm"
							title="Copy endpoint URL"
						/>
					</div>
				</SendLogsStep>

				<SendLogsStep number={3}>
					<div>
						<h3 class="font-semibold">Example request</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Quickwit expects NDJSON — one JSON document per line — with
							<InlineCode>Content-Type: application/x-ndjson</InlineCode>. Replace the payload with
							fields your index schema expects.
						</p>
					</div>
					<CodeBlock {...data.snippets.curl} copyTitle="Copy example" />
				</SendLogsStep>

				<SendLogsStep number={4} isLast>
					<div>
						<h3 class="font-semibold">Verify in Logwiz</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Open Search, pick <InlineCode>{data.selectedIndexId}</InlineCode> from the index selector,
							and look for the records you just sent.
						</p>
					</div>
					<div>
						<a
							href="/?index={encodeURIComponent(data.selectedIndexId)}"
							class="btn gap-2 btn-sm btn-accent"
						>
							<Search size={14} />
							Open Search
						</a>
					</div>
				</SendLogsStep>
			{/if}
		</ol>
	{/if}
</SendLogsSourceShell>
