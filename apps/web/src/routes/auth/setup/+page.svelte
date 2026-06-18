<script lang="ts">
	import * as v from 'valibot';
	import { setupPasswordSchema } from 'api/schemas';

	import { goto } from '$app/navigation';
	import { setupPassword } from '$lib/api/auth';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import AuthHeader from '$lib/components/auth/AuthHeader.svelte';
	import Field from '$lib/components/ui/Field.svelte';

	let { data } = $props();

	let password = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(setupPasswordSchema, { token: data.token, password });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			try {
				await setupPassword(parsed.output);
			} catch (err) {
				if (err instanceof ApiError && err.body) {
					fieldErrors = toFieldErrors(err.body);
					formError = err.message;
				} else {
					formError = err instanceof Error ? err.message : 'Failed to set password';
				}
				return;
			}
			await goto('/auth/sign-in');
		} finally {
			submitting = false;
		}
	}
</script>

{#if data.tokenStatus === 'valid'}
	<AuthHeader eyebrow="Set your password" title="Welcome to Rootprint" divider>
		Setting up the account for <span class="font-mono">{data.email}</span>.
	</AuthHeader>

	{#if formError}
		<div role="alert" class="alert alert-error mt-4 text-sm">{formError}</div>
	{/if}

	<form class="mt-4 space-y-3" {onsubmit}>
		<Field
			label="Password"
			type="password"
			autocomplete="new-password"
			minlength={8}
			bind:value={password}
			error={fieldErrors.password}
			hint="min 8 chars"
			required
		/>

		<button class="btn btn-primary mt-4 w-full" type="submit" disabled={submitting}>
			{submitting ? 'Setting password…' : 'Set password'}
		</button>
	</form>
{:else}
	<AuthHeader
		eyebrow="Invite link"
		title={data.tokenStatus === 'expired' ? 'Invite expired' : 'Invalid invite'}
	>
		{#if data.tokenStatus === 'expired'}
			This invite link has expired. Please ask your administrator for a new one.
		{:else}
			This invite link is invalid or has already been used. Please ask your administrator for a new
			one.
		{/if}
	</AuthHeader>
{/if}
