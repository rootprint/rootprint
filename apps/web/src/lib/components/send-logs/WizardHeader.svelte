<script lang="ts">
	import { page } from '$app/state';
	import CreateApiKeyModal from './CreateApiKeyModal.svelte';
	import ApiKeyChip from './ApiKeyChip.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import { resolveBreadcrumbs } from '$lib/settings-nav';
	import { DEP } from '$lib/api/deps';
	import type { Integration } from '$lib/send-logs/types';
	import type { ApiKeyView } from '$lib/api/api-keys';

	let {
		integration,
		indexId,
		apiKeys,
		indexIds,
		selectedApiKeyId = $bindable<number | null>(null),
		realApiKeyValue = $bindable<string | null>(null)
	}: {
		integration: Integration;
		indexId: string;
		apiKeys: ApiKeyView[];
		indexIds: string[];
		selectedApiKeyId?: number | null;
		realApiKeyValue?: string | null;
	} = $props();

	let createOpen = $state(false);

	const segments = $derived(resolveBreadcrumbs(page.route.id, page.params));

	function handleCreated(summary: ApiKeyView, secret: string) {
		selectedApiKeyId = summary.id;
		realApiKeyValue = secret;
		createOpen = false;
	}
</script>

<header class="flex flex-col gap-4">
	<Breadcrumb {segments} />
	<h1 class="text-h1">{integration.label}</h1>
	<p class="text-base-content/60 text-xs">
		Sending to <span class="text-base-content">{indexId}</span>
	</p>
	<ApiKeyChip
		{apiKeys}
		bind:selectedApiKeyId
		bind:realApiKeyValue
		onCreateRequested={() => (createOpen = true)}
	/>
</header>

<CreateApiKeyModal
	bind:open={createOpen}
	{indexIds}
	invalidateKey={DEP.sendLogsApiKeys}
	onCreated={handleCreated}
/>
