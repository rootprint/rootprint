<script lang="ts">
	import { page } from '$app/state';
	import SendLogsFlavorTabs from '$lib/components/admin/SendLogsFlavorTabs.svelte';
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import type { CaddyLogFlavor } from '$lib/types';

	const TABS: { id: CaddyLogFlavor; label: string }[] = [
		{ id: 'bare-metal', label: 'Bare-metal' },
		{ id: 'docker', label: 'Docker' }
	];

	let { data } = $props();

	const flavor = $derived.by<CaddyLogFlavor>(() => {
		const raw = page.url.searchParams.get('flavor');
		return TABS.some((tab) => tab.id === raw) ? (raw as CaddyLogFlavor) : 'bare-metal';
	});

	const bareSnippets = $derived(data.flavors?.['bare-metal']);
	const dockerSnippets = $derived(data.flavors?.docker);
</script>

<SendLogsSourceShell title="Caddy" docHref="https://docs.logwiz.io/send-logs/web-servers/caddy">
	{#if !data.token || !data.flavors}
		<SendLogsTokenCallout />
	{:else}
		<SendLogsFlavorTabs tabs={TABS} current={flavor} />

		{#if flavor === 'bare-metal' && bareSnippets}
			<ol class="flex flex-col">
				<SendLogsStep number={1}>
					<div>
						<h3 class="font-semibold">Enable Caddy file logging</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Stock Caddy installs log to <InlineCode>journald</InlineCode>. Add the following to
							<InlineCode>/etc/caddy/Caddyfile</InlineCode> so Caddy writes JSON to file instead. The
							<InlineCode>log</InlineCode> block has to be added to every site whose access log you want
							shipped — leave the default JSON encoder in place.
						</p>
					</div>
					<CodeBlock {...bareSnippets.caddyfile} copyTitle="Copy Caddyfile snippet" />
					<CodeBlock {...bareSnippets.reloadCaddy} copyTitle="Copy reload command" />
				</SendLogsStep>

				<SendLogsStep number={2}>
					<div>
						<h3 class="font-semibold">Install Vector</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Install the Vector package for your platform from the official installation page — the
							per-distro instructions are maintained upstream.
						</p>
					</div>
					<div>
						<a
							href="https://vector.dev/docs/setup/installation/"
							target="_blank"
							rel="noreferrer"
							class="btn gap-2 btn-sm btn-primary"
						>
							Open Vector installation
						</a>
					</div>
				</SendLogsStep>

				<SendLogsStep number={3}>
					<div>
						<h3 class="font-semibold">Write the Vector config</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Save this at <InlineCode>/etc/vector/vector.yaml</InlineCode>. The endpoint and token
							are prefilled.
						</p>
					</div>
					<CodeBlock {...bareSnippets.vectorConfig} copyTitle="Copy vector.yaml" />
				</SendLogsStep>

				<SendLogsStep number={4}>
					<div>
						<h3 class="font-semibold">Grant Vector read access to /var/log/caddy</h3>
						<p class="mt-1 text-sm text-base-content/60">
							The default Caddy package creates <InlineCode>/var/log/caddy/</InlineCode> owned by
							<InlineCode>caddy:caddy</InlineCode> with mode <InlineCode>750</InlineCode>, so add
							the
							<InlineCode>vector</InlineCode> user to the <InlineCode>caddy</InlineCode> group.
						</p>
					</div>
					<CodeBlock {...bareSnippets.groupAdd} copyTitle="Copy group-add command" />
				</SendLogsStep>

				<SendLogsStep number={5}>
					<div>
						<h3 class="font-semibold">Restart Vector</h3>
						<p class="mt-1 text-sm text-base-content/60">
							The status output should show <InlineCode>active (running)</InlineCode> with no config-parse
							or sink-startup errors in the recent log lines.
						</p>
					</div>
					<CodeBlock {...bareSnippets.restart} copyTitle="Copy restart command" />
				</SendLogsStep>

				<SendLogsStep number={6}>
					<div>
						<h3 class="font-semibold">Send a test request</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Hit any site Caddy is serving so it writes a fresh access-log line. Replace
							<InlineCode>http://localhost/</InlineCode> with whichever site URL you configured the
							<InlineCode>log</InlineCode> block on.
						</p>
					</div>
					<CodeBlock {...bareSnippets.test} copyTitle="Copy test command" />
				</SendLogsStep>

				<VerifySearchStep number={7}>
					Search for <InlineCode>service.name:caddy</InlineCode>. Records typically appear within
					5–10 seconds — the OTLP path commits on Quickwit's normal cadence, there is no
					<InlineCode>commit=wait_for</InlineCode> knob.
				</VerifySearchStep>
			</ol>
		{:else if flavor === 'docker' && dockerSnippets}
			<ol class="flex flex-col">
				<SendLogsStep number={1}>
					<div>
						<h3 class="font-semibold">Enable access logs if needed</h3>
						<p class="mt-1 text-sm text-base-content/60">
							If <InlineCode>docker logs caddy</InlineCode> already shows the request/access logs you
							want to ship, skip this step. If you only see startup logs and runtime errors, add the following
							<InlineCode>log</InlineCode> block to each site whose access logs you want shipped. Leave
							the default JSON encoder in place. If you change the
							<InlineCode>Caddyfile</InlineCode>, restart the Caddy container in step 4.
						</p>
					</div>
					<CodeBlock {...dockerSnippets.caddyfile} copyTitle="Copy Caddyfile snippet" />
				</SendLogsStep>

				<SendLogsStep number={2}>
					<div>
						<h3 class="font-semibold">Add the Vector service to your compose file</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Drop this service alongside your existing ones. Vector reads every container's logs
							through the Docker socket — no changes needed to your application services.
						</p>
					</div>
					<CodeBlock {...dockerSnippets.compose} copyTitle="Copy compose fragment" />
					<p class="text-sm text-base-content/60">
						The <InlineCode>include_containers</InlineCode> value in
						<InlineCode>vector.yaml</InlineCode> (see step 3) is set to <InlineCode
							>caddy</InlineCode
						>. Either set <InlineCode>container_name: caddy</InlineCode> on your Caddy compose service,
						or update <InlineCode>include_containers</InlineCode> to match the actual name shown by
						<InlineCode>{`docker ps --format '{{.Names}}'`}</InlineCode>.
					</p>
				</SendLogsStep>

				<SendLogsStep number={3}>
					<div>
						<h3 class="font-semibold">Save the Vector config</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Save this as <InlineCode>vector.yaml</InlineCode> next to your
							<InlineCode>compose.yml</InlineCode>. The endpoint and token are prefilled.
						</p>
					</div>
					<CodeBlock {...dockerSnippets.vectorConfig} copyTitle="Copy vector.yaml" />
				</SendLogsStep>

				<SendLogsStep number={4}>
					<div>
						<h3 class="font-semibold">Start Vector and restart Caddy if needed</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Bring the Vector sidecar up first so it's already streaming before Caddy restarts on
							the new logging config. Replace
							<InlineCode>&lt;your-caddy-service-name&gt;</InlineCode> with the Compose service key for
							Caddy. That's the name under <InlineCode>services:</InlineCode>, which can differ from
							<InlineCode>container_name</InlineCode>. If you skipped step 1 because access logs are
							already enabled, you only need to start Vector here.
						</p>
					</div>
					<CodeBlock {...dockerSnippets.run} copyTitle="Copy run command" />
				</SendLogsStep>

				<SendLogsStep number={5}>
					<div>
						<h3 class="font-semibold">Send a test request</h3>
						<p class="mt-1 text-sm text-base-content/60">
							Hit any site Caddy is serving so it writes a fresh access-log line. The command below
							assumes your Caddy container publishes port 80 on the host; substitute the port you've
							mapped, or run <InlineCode>curl</InlineCode> from inside the compose network.
						</p>
					</div>
					<CodeBlock {...dockerSnippets.test} copyTitle="Copy test command" />
				</SendLogsStep>

				<VerifySearchStep number={6}>
					Search for <InlineCode>service.name:caddy</InlineCode>. Records typically appear within
					5–10 seconds. <InlineCode>attributes.container.name</InlineCode> reads whatever Docker reports
					for your Caddy container. If you set <InlineCode>container_name: caddy</InlineCode>, it
					reads <InlineCode>caddy</InlineCode>. <InlineCode
						>attributes.container.image.name</InlineCode
					>
					reads whatever Caddy image you're running.
				</VerifySearchStep>
			</ol>
		{/if}
	{/if}
</SendLogsSourceShell>
