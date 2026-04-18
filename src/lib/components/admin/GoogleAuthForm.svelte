<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { saveGoogleAuthSettings } from '$lib/api/settings.remote';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { isValidDomain } from '$lib/schemas/settings';
	import type { GoogleAuthSettingsView } from '$lib/types';

	import RemoveGoogleAuthModal from './RemoveGoogleAuthModal.svelte';

	let { origin, settings }: { origin: string; settings: GoogleAuthSettingsView | null } = $props();

	const hasExistingSecret = $derived(settings !== null);

	let clientId = $state(settings?.clientId ?? '');
	let clientSecret = $state('');
	let allowedDomains = $state<string[]>(settings ? [...settings.allowedDomains] : []);
	let domainInput = $state('');
	let saving = $state(false);
	let removeModalOpen = $state(false);

	const secretPlaceholder = $derived(
		settings
			? `Current: ${settings.clientSecretMasked} (leave blank to keep)`
			: 'Enter client secret'
	);
	const callbackUrl = $derived(`${origin}/api/auth/callback/google`);

	function addDomain() {
		const domain = domainInput.trim().toLowerCase();
		if (!domain) return;
		if (!isValidDomain(domain)) {
			toast.error('Invalid domain format');
			return;
		}
		if (allowedDomains.includes(domain)) {
			toast.error('Domain already added');
			return;
		}
		allowedDomains = [...allowedDomains, domain];
		domainInput = '';
	}

	function removeDomain(domain: string) {
		allowedDomains = allowedDomains.filter((d) => d !== domain);
	}

	function handleDomainKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addDomain();
		}
	}

	async function handleSave() {
		if (!clientId.trim()) {
			toast.error('Client ID is required');
			return;
		}
		if (!hasExistingSecret && !clientSecret.trim()) {
			toast.error('Client Secret is required');
			return;
		}
		if (allowedDomains.length === 0) {
			toast.error('At least one domain is required');
			return;
		}

		saving = true;
		try {
			await saveGoogleAuthSettings({
				clientId: clientId.trim(),
				clientSecret: clientSecret.trim() || undefined,
				allowedDomains
			});
			toast.success('Google auth settings saved');
			await goto('/administration/authentication?saved=google', { invalidateAll: true });
		} catch {
			toast.error('Failed to save settings');
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<div>
		<label class="mb-1 block text-xs font-medium" for="googleClientId">Client ID</label>
		<input
			id="googleClientId"
			type="text"
			class="input-bordered input input-sm w-full"
			placeholder="123456789.apps.googleusercontent.com"
			bind:value={clientId}
		/>
	</div>

	<div>
		<label class="mb-1 block text-xs font-medium" for="googleClientSecret">Client Secret</label>
		<input
			id="googleClientSecret"
			type="password"
			class="input-bordered input input-sm w-full"
			placeholder={secretPlaceholder}
			bind:value={clientSecret}
		/>
		{#if hasExistingSecret}
			<p class="mt-1 text-[10px] text-base-content/40">Leave blank to keep current secret.</p>
		{/if}
	</div>

	<div>
		<label class="mb-1 block text-xs font-medium" for="domainInput">Allowed Domains</label>
		<div class="flex gap-2">
			<input
				id="domainInput"
				type="text"
				class="input-bordered input input-sm flex-1"
				placeholder="e.g. company.com"
				bind:value={domainInput}
				onkeydown={handleDomainKeydown}
			/>
			<button type="button" class="btn btn-outline btn-sm" onclick={addDomain}>Add</button>
		</div>
		{#if allowedDomains.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each allowedDomains as domain (domain)}
					<span class="badge gap-1 badge-outline">
						{domain}
						<button
							type="button"
							class="text-xs opacity-60 hover:opacity-100"
							onclick={() => removeDomain(domain)}
						>
							x
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div>
		<label class="mb-1 block text-xs font-medium" for="callbackUrl">Callback URL</label>
		<div class="flex gap-2">
			<input
				id="callbackUrl"
				type="text"
				class="input-bordered input input-sm w-full font-mono text-xs"
				value={callbackUrl}
				readonly
			/>
			<CopyButton text={callbackUrl} class="btn btn-outline btn-sm" title="Copy callback URL" />
		</div>
		<p class="mt-1 text-[10px] text-base-content/40">
			Add this URL as an authorized redirect URI in your Google Cloud Console.
		</p>
	</div>

	<div class="flex gap-2">
		<button class="btn btn-sm btn-accent" disabled={saving} onclick={handleSave}>
			{#if saving}
				<span class="loading loading-xs loading-spinner"></span>
				Saving...
			{:else}
				Save
			{/if}
		</button>
		{#if hasExistingSecret}
			<button
				class="btn btn-outline btn-sm btn-error"
				disabled={saving}
				onclick={() => (removeModalOpen = true)}
			>
				Remove Google Auth
			</button>
		{/if}
	</div>
</div>

<RemoveGoogleAuthModal bind:open={removeModalOpen} />
