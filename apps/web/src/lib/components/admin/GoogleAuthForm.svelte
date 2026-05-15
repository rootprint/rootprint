<script lang="ts">
	import { Pencil, X } from 'lucide-svelte';
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';
	import { googleAllowedDomainsSchema, googleCredentialsSchema } from 'api/schemas';

	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { ApiError, call } from '$lib/api/call';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import RemoveGoogleAuthModal from '$lib/components/admin/RemoveGoogleAuthModal.svelte';
	import type { GoogleAuthSettingsView } from '$lib/types';

	let {
		settings,
		origin
	}: {
		settings: GoogleAuthSettingsView;
		origin: string;
	} = $props();

	let clientId = $state('');
	let clientSecret = $state('');
	let allowedDomains = $state<string[]>(untrack(() => [...settings.allowedDomains]));
	let domainInput = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let removeOpen = $state(false);
	let editingCredentials = $state(false);
	let clientIdInput = $state<HTMLInputElement | null>(null);
	let clientSecretInput = $state<HTMLInputElement | null>(null);

	const isConfigured = $derived(settings.configured);
	const callbackUrl = $derived(`${origin}/api/auth/callback/google`);

	const credentialsHint = $derived.by(() => {
		if (!isConfigured) return 'Required to enable Google sign-in.';
		if (editingCredentials) return 'Both fields are required when rotating credentials.';
		return 'Credentials are stored. Use the edit icon to rotate them.';
	});

	async function startEditCredentials(focus: 'id' | 'secret') {
		editingCredentials = true;
		clientId = '';
		clientSecret = '';
		await tick();
		(focus === 'id' ? clientIdInput : clientSecretInput)?.focus();
	}

	function cancelEditCredentials() {
		editingCredentials = false;
		clientId = '';
		clientSecret = '';
		delete fieldErrors.clientId;
		delete fieldErrors.clientSecret;
	}

	function addDomain() {
		const domain = domainInput.trim().toLowerCase();
		if (!domain) return;
		if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
			fieldErrors.allowedDomains = 'Invalid domain format';
			return;
		}
		if (allowedDomains.includes(domain)) {
			fieldErrors.allowedDomains = 'Domain already added';
			return;
		}
		allowedDomains = [...allowedDomains, domain];
		domainInput = '';
		delete fieldErrors.allowedDomains;
	}

	function removeDomain(domain: string) {
		allowedDomains = allowedDomains.filter((d) => d !== domain);
	}

	function handleDomainKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addDomain();
		} else if (e.key === 'Backspace' && domainInput === '' && allowedDomains.length > 0) {
			allowedDomains = allowedDomains.slice(0, -1);
		}
	}

	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const id = clientId.trim();
		const secret = clientSecret.trim();
		const hasCredentialChange = id !== '' || secret !== '';

		if (!isConfigured && !hasCredentialChange) {
			formError = 'Client ID and Client Secret are required';
			return;
		}
		if (hasCredentialChange && (id === '' || secret === '')) {
			formError = 'Provide both Client ID and Client Secret to update credentials';
			return;
		}

		const domainsParsed = v.safeParse(googleAllowedDomainsSchema, { allowedDomains });
		if (!domainsParsed.success) {
			for (const issue of domainsParsed.issues) {
				fieldErrors.allowedDomains = issue.message;
			}
			return;
		}

		saving = true;
		try {
			if (hasCredentialChange) {
				const credParsed = v.safeParse(googleCredentialsSchema, {
					clientId: id,
					clientSecret: secret
				});
				if (!credParsed.success) {
					for (const issue of credParsed.issues) {
						const key = issue.path?.[0]?.key as string | undefined;
						if (key) fieldErrors[key] = issue.message;
					}
					return;
				}
				await call(api.api.settings.auth.google.credentials.$put({ json: credParsed.output }));
			}
			await call(
				api.api.settings.auth.google['allowed-domains'].$put({
					json: domainsParsed.output
				})
			);
			toast.success('Google authentication settings saved');
			await goto('/administration/authentication', { invalidateAll: true });
		} catch (err) {
			if (err instanceof ApiError) {
				formError = err.message;
				fieldErrors = { ...fieldErrors, ...err.fieldErrors };
				return;
			}
			throw err;
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-10" onsubmit={handleSave}>
	{#if formError}
		<div role="alert" class="alert alert-error text-sm">{formError}</div>
	{/if}

	<section class="flex flex-col gap-3">
		<header>
			<p class="eyebrow">Callback URL</p>
			<p class="text-base-content/60 mt-1 text-xs">
				Add this as an authorized redirect URI in Google Cloud Console.
			</p>
		</header>
		<div
			class="border-base-content/10 bg-base-200/40 rounded-box flex items-center gap-3 border px-3 py-2"
		>
			<code class="text-base-content flex-1 truncate font-mono text-xs">{callbackUrl}</code>
			<CopyButton
				text={callbackUrl}
				class="badge badge-ghost badge-sm cursor-pointer"
				ariaLabel="Copy callback URL"
			>
				{#snippet children({ copied }: { copied: boolean })}
					{copied ? 'Copied' : 'Copy'}
				{/snippet}
			</CopyButton>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<header>
			<p class="eyebrow">Credentials</p>
			<p class="text-base-content/60 mt-1 text-xs">{credentialsHint}</p>
		</header>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#if isConfigured && !editingCredentials}
				<label class="input w-full !border-base-content/10 !bg-base-200/40">
					<span class="label">Client ID</span>
					<input
						value="•••••••••••••••••"
						disabled
						class="text-base-content/50 disabled:!text-base-content/50"
						aria-label="Client ID (configured)"
					/>
					<button
						type="button"
						class="badge badge-ghost badge-sm cursor-pointer"
						aria-label="Edit Client ID"
						onclick={() => startEditCredentials('id')}
					>
						<Pencil size={12} />
					</button>
				</label>
				<label class="input w-full !border-base-content/10 !bg-base-200/40">
					<span class="label">Client Secret</span>
					<input
						value="•••••••••••••••••"
						disabled
						class="text-base-content/50 disabled:!text-base-content/50"
						aria-label="Client Secret (configured)"
					/>
					<button
						type="button"
						class="badge badge-ghost badge-sm cursor-pointer"
						aria-label="Edit Client Secret"
						onclick={() => startEditCredentials('secret')}
					>
						<Pencil size={12} />
					</button>
				</label>
			{:else}
				<div>
					<label class="input w-full" class:input-error={fieldErrors.clientId}>
						<span class="label">Client ID</span>
						<input
							bind:this={clientIdInput}
							bind:value={clientId}
							placeholder="12345.apps.googleusercontent.com"
							autocomplete="off"
						/>
						{#if isConfigured}
							<button
								type="button"
								class="badge badge-ghost badge-sm cursor-pointer"
								aria-label="Cancel editing credentials"
								onclick={cancelEditCredentials}
							>
								<X size={12} />
							</button>
						{/if}
					</label>
					{#if fieldErrors.clientId}
						<p class="text-error mt-1 font-mono text-xs">{fieldErrors.clientId}</p>
					{/if}
				</div>
				<div>
					<label class="input w-full" class:input-error={fieldErrors.clientSecret}>
						<span class="label">Client Secret</span>
						<input
							bind:this={clientSecretInput}
							bind:value={clientSecret}
							type="password"
							placeholder="Client secret"
							autocomplete="off"
						/>
						{#if isConfigured}
							<button
								type="button"
								class="badge badge-ghost badge-sm cursor-pointer"
								aria-label="Cancel editing credentials"
								onclick={cancelEditCredentials}
							>
								<X size={12} />
							</button>
						{/if}
					</label>
					{#if fieldErrors.clientSecret}
						<p class="text-error mt-1 font-mono text-xs">{fieldErrors.clientSecret}</p>
					{/if}
				</div>
			{/if}
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<header>
			<p class="eyebrow">Allowed domains</p>
			<p class="text-base-content/60 mt-1 text-xs">
				Only users with an email from these domains can sign in.
			</p>
		</header>
		<div
			class="border-base-content/10 focus-within:border-base-content bg-base-100 rounded-box flex flex-wrap items-center gap-1.5 border px-2 py-2 transition-colors"
			class:!border-error={fieldErrors.allowedDomains}
		>
			{#each allowedDomains as domain (domain)}
				<span
					class="bg-base-200 flex items-center gap-1 rounded px-2 py-1 font-mono text-xs"
				>
					{domain}
					<button
						type="button"
						class="cursor-pointer opacity-50 hover:opacity-100"
						aria-label="Remove {domain}"
						onclick={() => removeDomain(domain)}
					>
						<X size={12} />
					</button>
				</span>
			{/each}
			<input
				bind:value={domainInput}
				placeholder={allowedDomains.length === 0
					? 'company.com  (press Enter to add)'
					: 'Add another…'}
				autocomplete="off"
				aria-label="Add domain"
				class="placeholder:text-base-content/40 min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
				onkeydown={handleDomainKeydown}
			/>
		</div>
		{#if fieldErrors.allowedDomains}
			<p class="text-error font-mono text-xs">{fieldErrors.allowedDomains}</p>
		{/if}
	</section>

	<div class="flex items-center justify-between gap-2">
		{#if isConfigured}
			<button
				type="button"
				class="btn btn-ghost text-error hover:bg-error/10 cursor-pointer"
				disabled={saving}
				onclick={() => (removeOpen = true)}
			>
				Remove Google auth
			</button>
		{:else}
			<span></span>
		{/if}
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
	</div>
</form>

<RemoveGoogleAuthModal bind:open={removeOpen} />
