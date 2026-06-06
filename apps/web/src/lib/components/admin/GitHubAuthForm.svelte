<script lang="ts">
	import { Pencil, X } from 'lucide-svelte';
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';
	import { githubAllowedOrgsSchema, githubCredentialsSchema } from 'api/schemas';

	import { goto } from '$app/navigation';
	import {
		saveGitHubCredentials,
		saveGitHubAllowedOrgs,
		AuthConfigApiError
	} from '$lib/api/auth-config';
	import { issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import DisplayField from '$lib/components/ui/DisplayField.svelte';
	import type { GitHubAuthSettingsView } from '$lib/api/auth-config';

	let {
		settings,
		origin
	}: {
		settings: GitHubAuthSettingsView;
		origin: string;
	} = $props();

	const orgPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

	let clientId = $state('');
	let clientSecret = $state('');
	let allowedOrgs = $state<string[]>(untrack(() => [...settings.allowedOrgs]));
	let orgInput = $state('');
	let saving = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let editingCredentials = $state(false);
	let clientIdInput = $state<HTMLInputElement | null>(null);
	let clientSecretInput = $state<HTMLInputElement | null>(null);

	const isConfigured = $derived(settings.configured);
	const callbackUrl = $derived(`${origin}/api/auth/callback/github`);

	const clientIdHint = $derived.by(() => {
		if (!isConfigured) return 'From your GitHub OAuth App.';
		if (editingCredentials) return 'Both fields are required when rotating credentials.';
		return 'Stored — use the edit icon to rotate.';
	});

	const clientSecretHint = $derived.by(() => {
		if (!isConfigured) return 'Server-side secret from your GitHub OAuth App.';
		if (editingCredentials) return 'Both fields are required when rotating credentials.';
		return 'Stored — use the edit icon to rotate.';
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

	function addOrg() {
		const org = orgInput.trim();
		if (!org) return;
		if (!orgPattern.test(org)) {
			fieldErrors.allowedOrgs = 'Invalid organization name';
			return;
		}
		if (allowedOrgs.includes(org)) {
			fieldErrors.allowedOrgs = 'Organization already added';
			return;
		}
		allowedOrgs = [...allowedOrgs, org];
		orgInput = '';
		delete fieldErrors.allowedOrgs;
	}

	function removeOrg(org: string) {
		allowedOrgs = allowedOrgs.filter((o) => o !== org);
	}

	function handleOrgKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addOrg();
		} else if (e.key === 'Backspace' && orgInput === '' && allowedOrgs.length > 0) {
			allowedOrgs = allowedOrgs.slice(0, -1);
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

		const orgsParsed = v.safeParse(githubAllowedOrgsSchema, { allowedOrgs });
		if (!orgsParsed.success) {
			fieldErrors = issuesToFieldErrors(orgsParsed.issues);
			return;
		}

		saving = true;
		try {
			if (hasCredentialChange) {
				const credParsed = v.safeParse(githubCredentialsSchema, {
					clientId: id,
					clientSecret: secret
				});
				if (!credParsed.success) {
					fieldErrors = issuesToFieldErrors(credParsed.issues);
					return;
				}
				try {
					await saveGitHubCredentials(credParsed.output);
				} catch (err) {
					if (err instanceof AuthConfigApiError && err.body) {
						fieldErrors = { ...fieldErrors, ...toFieldErrors(err.body) };
						toast.error(err.message);
					} else {
						toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
					}
					return;
				}
			}
			try {
				await saveGitHubAllowedOrgs(orgsParsed.output);
			} catch (err) {
				if (err instanceof AuthConfigApiError && err.body) {
					fieldErrors = { ...fieldErrors, ...toFieldErrors(err.body) };
					toast.error(err.message);
				} else {
					toast.error(err instanceof Error ? err.message : 'Failed to save allowed organizations');
				}
				return;
			}
			toast.success('GitHub authentication settings saved');
			await goto('/settings/authentication', { invalidateAll: true });
		} finally {
			saving = false;
		}
	}
</script>

<form
	onsubmit={handleSave}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	{#if formError}
		<div role="alert" class="alert alert-error mx-4 mt-4 text-sm">{formError}</div>
	{/if}

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<div class="text-sm">Callback URL</div>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Add this as the Authorization callback URL in your GitHub OAuth App.
			</div>
		</div>
		<div class="border-line bg-base-200/40 rounded-box flex items-center gap-3 border px-3 py-2">
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
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			{#if isConfigured && !editingCredentials}
				<div class="text-sm">Client ID</div>
			{:else}
				<label for="cfg-github-client-id" class="text-sm">Client ID</label>
			{/if}
			<div class="text-base-content/60 mt-0.5 text-xs">{clientIdHint}</div>
		</div>
		<div class="flex flex-col gap-1">
			{#if isConfigured && !editingCredentials}
				<DisplayField value="•••••••••••••••••" ariaLabel="Client ID (configured)">
					{#snippet action()}
						<button
							type="button"
							class="badge badge-ghost badge-sm cursor-pointer"
							aria-label="Edit Client ID"
							onclick={() => startEditCredentials('id')}
						>
							<Pencil class="h-3 w-3" />
						</button>
					{/snippet}
				</DisplayField>
			{:else}
				<label class="input input-sm w-full" class:input-error={fieldErrors.clientId}>
					<input
						id="cfg-github-client-id"
						bind:this={clientIdInput}
						bind:value={clientId}
						placeholder="Iv1.0123456789abcdef"
						autocomplete="off"
					/>
					{#if isConfigured}
						<button
							type="button"
							class="badge badge-ghost badge-sm cursor-pointer"
							aria-label="Cancel editing credentials"
							onclick={cancelEditCredentials}
						>
							<X class="h-3 w-3" />
						</button>
					{/if}
				</label>
			{/if}
			{#if fieldErrors.clientId}
				<p class="text-error text-xs">{fieldErrors.clientId}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			{#if isConfigured && !editingCredentials}
				<div class="text-sm">Client Secret</div>
			{:else}
				<label for="cfg-github-client-secret" class="text-sm">Client Secret</label>
			{/if}
			<div class="text-base-content/60 mt-0.5 text-xs">{clientSecretHint}</div>
		</div>
		<div class="flex flex-col gap-1">
			{#if isConfigured && !editingCredentials}
				<DisplayField value="•••••••••••••••••" ariaLabel="Client Secret (configured)">
					{#snippet action()}
						<button
							type="button"
							class="badge badge-ghost badge-sm cursor-pointer"
							aria-label="Edit Client Secret"
							onclick={() => startEditCredentials('secret')}
						>
							<Pencil class="h-3 w-3" />
						</button>
					{/snippet}
				</DisplayField>
			{:else}
				<label class="input input-sm w-full" class:input-error={fieldErrors.clientSecret}>
					<input
						id="cfg-github-client-secret"
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
							<X class="h-3 w-3" />
						</button>
					{/if}
				</label>
			{/if}
			{#if fieldErrors.clientSecret}
				<p class="text-error text-xs">{fieldErrors.clientSecret}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-[260px_1fr] gap-6 px-4 py-4">
		<div>
			<div class="text-sm">Allowed organizations</div>
			<div class="text-base-content/60 mt-0.5 text-xs">
				Only members of these GitHub organizations can sign in.
			</div>
		</div>
		<div class="flex flex-col gap-1">
			<div
				class="border-line focus-within:border-base-content bg-base-100 rounded-box flex flex-wrap items-center gap-1.5 border px-2 py-1.5 transition-colors"
				class:!border-error={fieldErrors.allowedOrgs}
			>
				{#each allowedOrgs as org (org)}
					<span class="bg-base-200 flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs">
						{org}
						<button
							type="button"
							class="cursor-pointer opacity-50 hover:opacity-100"
							aria-label="Remove {org}"
							onclick={() => removeOrg(org)}
						>
							<X class="h-3 w-3" />
						</button>
					</span>
				{/each}
				<input
					bind:value={orgInput}
					placeholder={allowedOrgs.length === 0 ? 'my-org  (press Enter to add)' : 'Add another…'}
					autocomplete="off"
					aria-label="Add organization"
					class="placeholder:text-base-content/40 min-w-40 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
					onkeydown={handleOrgKeydown}
				/>
			</div>
			{#if fieldErrors.allowedOrgs}
				<p class="text-error text-xs">{fieldErrors.allowedOrgs}</p>
			{/if}
		</div>
	</div>

	<div class="flex justify-end px-4 py-3">
		<button type="submit" class="btn btn-primary btn-sm" disabled={saving}>
			{#if saving}
				<span class="loading loading-spinner loading-xs"></span>
				Saving…
			{:else}
				Save
			{/if}
		</button>
	</div>
</form>
