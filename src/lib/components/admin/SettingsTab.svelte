<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { saveGoogleAuthSettings } from '$lib/api/settings.remote';
	import RemoveGoogleAuthModal from './RemoveGoogleAuthModal.svelte';
	import type { GoogleAuthSettingsView } from '$lib/types';

	let { origin, settings }: { origin: string; settings: GoogleAuthSettingsView | null } = $props();

	let clientId = $state('');
	let clientSecret = $state('');
	let clientSecretMasked = $state('');
	let allowedDomains = $state<string[]>([]);
	let domainInput = $state('');
	let saving = $state(false);
	let hasExistingSecret = $state(false);
	let savedSuccessfully = $state(false);
	let removeModalOpen = $state(false);

	$effect(() => {
		if (settings) {
			clientId = settings.clientId;
			clientSecretMasked = settings.clientSecretMasked;
			allowedDomains = [...settings.allowedDomains];
			hasExistingSecret = true;
		} else {
			clientId = '';
			clientSecretMasked = '';
			allowedDomains = [];
			hasExistingSecret = false;
		}
		clientSecret = '';
	});

	function addDomain() {
		const domain = domainInput.trim().toLowerCase();
		if (!domain) return;
		if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
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
			savedSuccessfully = true;
			await invalidateAll();
		} catch (e) {
			toast.error('Failed to save settings');
		} finally {
			saving = false;
		}
	}

	function handleRemoved() {
		savedSuccessfully = true;
	}

	const callbackUrl = $derived(`${origin}/api/auth/callback/google`);
</script>

<div class="card border border-base-300 bg-base-100">
	<div class="card-body">
		<h3 class="card-title text-base">Google Authentication</h3>
		<p class="text-sm text-base-content/60">
			Configure Google OAuth to allow users from specific domains to sign in.
		</p>

		{#if savedSuccessfully}
			<div class="alert text-sm alert-warning">
				Settings saved. Restart the server for changes to take effect.
			</div>
		{/if}

		<div class="mt-2 flex flex-col gap-4">
			<div>
				<label class="mb-1 block text-xs font-medium" for="googleClientId"> Client ID </label>
				<input
					id="googleClientId"
					type="text"
					class="input-bordered input input-sm w-full"
					placeholder="123456789.apps.googleusercontent.com"
					bind:value={clientId}
				/>
			</div>

			<div>
				<label class="mb-1 block text-xs font-medium" for="googleClientSecret">
					Client Secret
				</label>
				<input
					id="googleClientSecret"
					type="password"
					class="input-bordered input input-sm w-full"
					placeholder={hasExistingSecret
						? `Current: ${clientSecretMasked} (leave blank to keep)`
						: 'Enter client secret'}
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
					<button type="button" class="btn btn-outline btn-sm" onclick={addDomain}> Add </button>
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
	</div>
</div>

<RemoveGoogleAuthModal bind:open={removeModalOpen} onremove={handleRemoved} />
