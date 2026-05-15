<script lang="ts">
	import { X } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import * as v from 'valibot';
	import {
		googleAllowedDomainsSchema,
		googleCredentialsSchema
	} from 'api/schemas';

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

	const isConfigured = $derived(settings.configured);
	const callbackUrl = $derived(`${origin}/api/auth/callback/google`);

	const credentialsHint = $derived(
		isConfigured
			? 'Leave both fields blank to keep current credentials.'
			: 'Required to enable Google sign-in.'
	);

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
				await call(
					api.api.settings.auth.google.credentials.$put({ json: credParsed.output })
				);
			}
			await call(
				api.api.settings.auth.google['allowed-domains'].$put({
					json: domainsParsed.output
				})
			);
			await goto('/administration/authentication?saved=google', { invalidateAll: true });
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

<form class="flex flex-col gap-4" onsubmit={handleSave}>
	{#if formError}
		<div role="alert" class="alert alert-error text-sm">{formError}</div>
	{/if}

	<label class="input w-full" class:input-error={fieldErrors.clientId}>
		<span class="label">Client ID</span>
		<input
			bind:value={clientId}
			placeholder={isConfigured ? '••••• (leave blank to keep)' : '12345.apps.googleusercontent.com'}
			autocomplete="off"
		/>
	</label>
	{#if fieldErrors.clientId}
		<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.clientId}</p>
	{/if}

	<label class="input w-full" class:input-error={fieldErrors.clientSecret}>
		<span class="label">Client Secret</span>
		<input
			bind:value={clientSecret}
			type="password"
			placeholder={isConfigured ? '••••• (leave blank to keep)' : 'Client secret'}
			autocomplete="off"
		/>
	</label>
	{#if fieldErrors.clientSecret}
		<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.clientSecret}</p>
	{:else}
		<p class="text-base-content/50 -mt-2 font-mono text-xs">{credentialsHint}</p>
	{/if}

	<div>
		<label class="input w-full" class:input-error={fieldErrors.allowedDomains}>
			<span class="label">Allowed domains</span>
			<input
				bind:value={domainInput}
				placeholder="company.com"
				autocomplete="off"
				onkeydown={handleDomainKeydown}
			/>
			<button type="button" class="badge badge-ghost badge-sm" onclick={addDomain}>Add</button>
		</label>
		{#if fieldErrors.allowedDomains}
			<p class="text-error mt-1 font-mono text-xs">{fieldErrors.allowedDomains}</p>
		{/if}
		{#if allowedDomains.length > 0}
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each allowedDomains as domain (domain)}
					<span
						class="hairline rounded-box flex items-center gap-1 px-2 py-0.5 font-mono text-xs"
					>
						{domain}
						<button
							type="button"
							class="opacity-60 hover:opacity-100"
							aria-label="Remove {domain}"
							onclick={() => removeDomain(domain)}
						>
							<X size={12} />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div>
		<p class="label">Callback URL</p>
		<div class="flex gap-2">
			<input
				class="input flex-1 font-mono text-xs"
				value={callbackUrl}
				readonly
				aria-label="Callback URL"
			/>
			<CopyButton text={callbackUrl} ariaLabel="Copy callback URL">
				{#snippet children({ copied })}
					{copied ? 'Copied' : 'Copy'}
				{/snippet}
			</CopyButton>
		</div>
		<p class="text-base-content/50 mt-1 font-mono text-xs">
			Add this URL as an authorized redirect URI in Google Cloud Console.
		</p>
	</div>

	<div class="mt-4 flex items-center justify-between gap-2">
		{#if isConfigured}
			<button
				type="button"
				class="btn btn-ghost text-error btn-sm"
				disabled={saving}
				onclick={() => (removeOpen = true)}
			>
				Remove Google auth
			</button>
		{:else}
			<span></span>
		{/if}
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save'}
		</button>
	</div>
</form>

<RemoveGoogleAuthModal bind:open={removeOpen} />
