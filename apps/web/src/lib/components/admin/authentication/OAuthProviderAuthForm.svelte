<script lang="ts">
	import { Pencil, X } from 'lucide-svelte';
	import { tick, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { ApiError, toFieldErrors } from '$lib/api/errors';
	import type { OAuthProviderDescriptor } from '$lib/components/admin/authentication/oauth-providers';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import DisplayField from '$lib/components/ui/DisplayField.svelte';
	import SettingsRow from '$lib/components/ui/SettingsRow.svelte';
	import TagInput from '$lib/components/ui/TagInput.svelte';

	let {
		provider,
		configured,
		initialItems,
		origin
	}: {
		provider: OAuthProviderDescriptor;
		configured: boolean;
		initialItems: string[];
		origin: string;
	} = $props();

	let clientId = $state('');
	let clientSecret = $state('');
	let items = $state<string[]>(untrack(() => [...initialItems]));
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let editingCredentials = $state(false);
	let clientIdInput = $state<HTMLInputElement | null>(null);
	let clientSecretInput = $state<HTMLInputElement | null>(null);

	const callbackUrl = $derived(`${origin}/api/auth/callback/${provider.id}`);

	const clientIdHint = $derived.by(() => {
		if (!configured) return provider.clientIdHint;
		if (editingCredentials) return 'Both fields are required when rotating credentials.';
		return 'Stored — use the edit icon to rotate.';
	});

	const clientSecretHint = $derived.by(() => {
		if (!configured) return provider.clientSecretHint;
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

	function setItemsError(message: string | null) {
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

		const id = clientId.trim();
		const secret = clientSecret.trim();
		const hasCredentialChange = id !== '' || secret !== '';

		if (!configured && !hasCredentialChange) {
			formError = 'Client ID and Client Secret are required';
			return;
		}
		if (hasCredentialChange && (id === '' || secret === '')) {
			formError = 'Provide both Client ID and Client Secret to update credentials';
			return;
		}

		const itemErrors = provider.items.validateItems(items);
		if (itemErrors) {
			fieldErrors = itemErrors;
			return;
		}

		submitting = true;
		try {
			if (hasCredentialChange) {
				const credErrors = provider.validateCredentials({ clientId: id, clientSecret: secret });
				if (credErrors) {
					fieldErrors = credErrors;
					return;
				}
				try {
					await provider.saveCredentials({ clientId: id, clientSecret: secret });
				} catch (err) {
					if (err instanceof ApiError && err.body) {
						fieldErrors = { ...fieldErrors, ...toFieldErrors(err.body) };
						formError = err.message;
					} else {
						formError = err instanceof Error ? err.message : 'Failed to save credentials';
					}
					return;
				}
			}
			try {
				await provider.items.saveItems(items);
			} catch (err) {
				if (err instanceof ApiError && err.body) {
					fieldErrors = { ...fieldErrors, ...toFieldErrors(err.body) };
					formError = err.message;
				} else {
					formError = err instanceof Error ? err.message : provider.items.saveFailedFallback;
				}
				return;
			}
			toast.success(provider.successToast);
			await goto('/settings/authentication', { invalidateAll: true });
		} finally {
			submitting = false;
		}
	}
</script>

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

	<SettingsRow
		plain={configured && !editingCredentials}
		id="cfg-{provider.id}-client-id"
		label="Client ID"
		hint={clientIdHint}
		error={fieldErrors.clientId}
	>
		{#snippet children({ id, invalid, describedBy })}
			{#if configured && !editingCredentials}
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
				<label class="input input-sm w-full" class:input-error={invalid}>
					<input
						{id}
						bind:this={clientIdInput}
						bind:value={clientId}
						placeholder={provider.clientIdPlaceholder}
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

	<SettingsRow
		plain={configured && !editingCredentials}
		id="cfg-{provider.id}-client-secret"
		label="Client Secret"
		hint={clientSecretHint}
		error={fieldErrors.clientSecret}
	>
		{#snippet children({ id, invalid, describedBy })}
			{#if configured && !editingCredentials}
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
				<label class="input input-sm w-full" class:input-error={invalid}>
					<input
						{id}
						bind:this={clientSecretInput}
						bind:value={clientSecret}
						type="password"
						placeholder="Client secret"
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

	<SettingsRow
		plain
		label={provider.items.label}
		hint={provider.items.description}
		error={fieldErrors[provider.items.fieldKey]}
	>
		{#snippet children({ invalid })}
			<TagInput
				bind:tags={items}
				placeholderEmpty={provider.items.placeholderEmpty}
				addLabel={provider.items.addLabel}
				normalize={provider.items.normalize}
				validate={provider.items.validate}
				duplicateMessage={provider.items.duplicateMessage}
				error={invalid}
				onError={setItemsError}
			/>
		{/snippet}
	</SettingsRow>

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
