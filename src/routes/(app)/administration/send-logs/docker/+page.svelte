<script lang="ts">
	import { Search } from 'lucide-svelte';

	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Docker" docHref="https://docs.logwiz.io/send-logs/platforms/docker">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Create the Vector config</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this as <InlineCode>vector.yaml</InlineCode> next to your
						<InlineCode>docker-compose.yml</InlineCode>. The endpoint and token are prefilled.
					</p>
				</div>
				<CodeBlock {...data.snippets.collectorConfig} copyTitle="Copy vector.yaml" />
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Add the Vector service to your compose file</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Drop this service alongside your existing ones. The Vector container reads every other
						container's logs through the Docker socket — no changes needed to your application
						services.
					</p>
				</div>
				<CodeBlock {...data.snippets.compose} copyTitle="Copy compose fragment" />
				<p class="text-sm text-base-content/60">
					The <InlineCode>container_name</InlineCode> and the
					<InlineCode>exclude_containers</InlineCode> value in <InlineCode>vector.yaml</InlineCode>
					must match — that's how Vector skips its own logs. Change one, change the other.
				</p>
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Start the Vector service</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Bring the sidecar up. Your other services keep running untouched.
					</p>
				</div>
				<CodeBlock {...data.snippets.run} copyTitle="Copy run command" />
			</SendLogsStep>

			<SendLogsStep number={4}>
				<div>
					<h3 class="font-semibold">Send a test log line</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Run a throwaway container that prints one line and exits. Vector picks it up from the
						daemon and ships it with <InlineCode>service.name</InlineCode> set to the container's name.
					</p>
				</div>
				<CodeBlock {...data.snippets.test} copyTitle="Copy test command" />
			</SendLogsStep>

			<SendLogsStep number={5} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Open Search and query for <InlineCode>hello from logwiz</InlineCode>. The record
						typically arrives within ~5 seconds (one batch interval).
						<InlineCode>service.name</InlineCode> reads
						<InlineCode>logwiz-smoke-test</InlineCode>;
						<InlineCode>attributes.container.image.name</InlineCode> reads
						<InlineCode>alpine</InlineCode>.
					</p>
				</div>
				<div>
					<a
						href="/?index={encodeURIComponent(DEFAULT_OTEL_LOGS_INDEX_ID)}"
						class="btn gap-2 btn-sm btn-accent"
					>
						<Search size={14} />
						Open Search
					</a>
				</div>
			</SendLogsStep>
		</ol>
	{/if}
</SendLogsSourceShell>
