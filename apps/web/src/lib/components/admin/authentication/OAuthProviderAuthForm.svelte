<script lang="ts">
	import { Pencil, X } from 'lucide-svelte';
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { toFormErrors } from '$lib/api/errors';
	import type { OAuthProviderDescriptor } from '$lib/components/admin/authentication/oauth-providers';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import DisplayField from '$lib/components/ui/DisplayField.svelte';
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';

	type CredKey = 'issuerUrl' | 'clientId' | 'clientSecret';

	let {
		provider,
		configured,
		initialItems = [],
		initialIssuerUrl = '',
		origin
	}: {
		provider: OAuthProviderDescriptor;
		configured: boolean;
		initialItems?: string[];
		initialIssuerUrl?: string;
		origin: string;
	} = $props();

	const emptyCreds = () => ({ issuerUrl: '', clientId: '', clientSecret: '' });
	let creds = $state(emptyCreds());
	let credInputs = $state<Record<CredKey, HTMLInputElement | null>>({
		issuerUrl: null,
		clientId: null,
		clientSecret: null
	});
	let items = $state<string[]>(untrack(() => [...initialItems]));
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let editingCredentials = $state(false);

	const callbackUrl = $derived(`${origin}/api/auth/callback/${provider.id}`);
	const locked = $derived(configured && !editingCredentials);

	function credentialHint(unconfiguredHint: string): string {
		if (!configured) return unconfiguredHint;
		if (editingCredentials) {
			return provider.issuer
				? 'All three fields are required when rotating credentials.'
				: 'Both fields are required when rotating credentials.';
		}
		return 'Stored — use the edit icon to rotate.';
	}

	async function startEditCredentials(focus: CredKey) {
		editingCredentials = true;
		creds = emptyCreds();
		await tick();
		credInputs[focus]?.focus();
	}

	function cancelEditCredentials() {
		editingCredentials = false;
		creds = emptyCreds();
		delete fieldErrors.issuerUrl;
		delete fieldErrors.clientId;
		delete fieldErrors.clientSecret;
	}

	function setItemsError(message: string | null) {
		if (!provider.items) return;
		if (message) {
			fieldErrors[provider.items.fieldKey] = message;
		} else {
			delete fieldErrors[provider.items.fieldKey];
		}
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const issuerUrl = creds.issuerUrl.trim();
		const id = creds.clientId.trim();
		const secret = creds.clientSecret.trim();
		const credFields = provider.issuer ? [issuerUrl, id, secret] : [id, secret];
		const filled = credFields.filter((f) => f !== '').length;
		const hasCredentialChange = filled > 0;
		const fieldsLabel = provider.issuer
			? 'Issuer URL, Client ID and Client Secret'
			: 'Client ID and Client Secret';

		if (!configured && !hasCredentialChange) {
			formError = `${fieldsLabel} are required`;
			return;
		}
		if (hasCredentialChange && filled !== credFields.length) {
			formError = `Provide ${fieldsLabel} to update credentials`;
			return;
		}
		if (!hasCredentialChange && !provider.items) {
			await goto('/settings/authentication');
			return;
		}

		if (provider.items) {
			const itemErrors = provider.items.validateItems(items);
			if (itemErrors) {
				fieldErrors = itemErrors;
				return;
			}
		}

		submitting = true;
		try {
			if (hasCredentialChange) {
				const input = { issuerUrl, clientId: id, clientSecret: secret };
				const credErrors = provider.validateCredentials(input);
				if (credErrors) {
					fieldErrors = credErrors;
					return;
				}
				try {
					await provider.saveCredentials(input);
				} catch (err) {
					const formErrors = toFormErrors(err, 'Failed to save credentials');
					formError = formErrors.message;
					fieldErrors = { ...fieldErrors, ...formErrors.fieldErrors };
					return;
				}
			}
			if (provider.items) {
				try {
					await provider.items.saveItems(items);
				} catch (err) {
					const formErrors = toFormErrors(err, provider.items.saveFailedFallback);
					formError = formErrors.message;
					fieldErrors = { ...fieldErrors, ...formErrors.fieldErrors };
					return;
				}
			}
			toast.success(provider.successToast);
			await goto('/settings/authentication', { invalidateAll: true });
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet credentialRow(
	key: CredKey,
	label: string,
	unconfiguredHint: string,
	placeholder: string,
	type: 'text' | 'password' | 'url'
)}
	{@const lockedValue = key === 'issuerUrl' ? initialIssuerUrl : '•••••••••••••••••'}
	<SettingsRow
		plain={locked}
		id="cfg-{provider.id}-{key}"
		{label}
		hint={credentialHint(unconfiguredHint)}
		error={fieldErrors[key]}
	>
		{#snippet children({ id, invalid, describedBy })}
			{#if locked}
				<DisplayField value={lockedValue} ariaLabel="{label} (configured)">
					{#snippet action()}
						<button
							type="button"
							class="badge badge-ghost badge-sm cursor-pointer"
							aria-label="Edit {label}"
							onclick={() => startEditCredentials(key)}
						>
							<Pencil class="h-3 w-3" />
						</button>
					{/snippet}
				</DisplayField>
			{:else}
				<label class="input input-sm w-full" class:input-error={invalid}>
					<input
						{id}
						{type}
						{placeholder}
						bind:this={credInputs[key]}
						bind:value={creds[key]}
						autocomplete="off"
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
					/>
					{#if configured}
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
		{/snippet}
	</SettingsRow>
{/snippet}

<form
	{onsubmit}
	class="border-line rounded-box bg-base-100 divide-line flex flex-col divide-y border"
>
	{#if formError}
		<div role="alert" class="alert alert-error mx-4 mt-4 text-sm">{formError}</div>
	{/if}

	<SettingsRow plain label="Callback URL" hint={provider.callbackDescription}>
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
	</SettingsRow>

	{#if provider.issuer}
		{@render credentialRow(
			'issuerUrl',
			'Issuer URL',
			provider.issuer.hint,
			provider.issuer.placeholder,
			'url'
		)}
	{/if}
	{@render credentialRow(
		'clientId',
		'Client ID',
		provider.clientIdHint,
		provider.clientIdPlaceholder,
		'text'
	)}
	{@render credentialRow(
		'clientSecret',
		'Client Secret',
		provider.clientSecretHint,
		'Client secret',
		'password'
	)}

	{#if provider.items}
		{@const providerItems = provider.items}
		<SettingsRow
			plain
			label={providerItems.label}
			hint={providerItems.description}
			error={fieldErrors[providerItems.fieldKey]}
		>
			{#snippet children({ invalid })}
				<TagInput
					bind:tags={items}
					placeholderEmpty={providerItems.placeholderEmpty}
					addLabel={providerItems.addLabel}
					normalize={providerItems.normalize}
					validate={providerItems.validate}
					duplicateMessage={providerItems.duplicateMessage}
					error={invalid}
					onError={setItemsError}
				/>
			{/snippet}
		</SettingsRow>
	{/if}

	<div class="flex justify-end px-4 py-3">
		<button type="submit" class="btn btn-primary btn-sm" disabled={submitting}>
			{#if submitting}
				<span class="loading loading-spinner loading-xs"></span>
				Saving…
			{:else}
				Save
			{/if}
		</button>
	</div>
</form>
