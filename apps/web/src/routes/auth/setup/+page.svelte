<script lang="ts">
	import * as v from 'valibot';
	import { setupPasswordSchema } from 'api/schemas';

	import { goto } from '$app/navigation';
	import { setupPassword, AuthApiError } from '$lib/api/auth';
	import { toFieldErrors } from '$lib/api/errors';

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
			for (const issue of parsed.issues) {
				const key = issue.path?.[0]?.key as string | undefined;
				if (key) fieldErrors[key] = issue.message;
			}
			return;
		}

		submitting = true;
		try {
			await setupPassword(parsed.output);
			await goto('/auth/sign-in');
		} catch (e) {
			if (e instanceof AuthApiError && e.body) {
				fieldErrors = toFieldErrors(e.body);
				formError = e.message;
			} else {
				formError = e instanceof Error ? e.message : 'Failed to set password';
			}
			return;
		} finally {
			submitting = false;
		}
	}
</script>

{#if data.tokenStatus === 'valid'}
	<p class="eyebrow mb-2">Set your password</p>
	<h1 class="text-3xl tracking-tight">Welcome to Logwiz</h1>
	<p class="text-base-content/60 mt-2 text-sm">
		Setting up the account for <span class="font-mono">{data.email}</span>.
	</p>

	{#if formError}
		<div role="alert" class="alert alert-error mt-6 text-sm">{formError}</div>
	{/if}

	<form class="mt-6 space-y-3" {onsubmit}>
		<label class="input w-full" class:input-error={fieldErrors.password}>
			<span class="label">Password</span>
			<input
				bind:value={password}
				type="password"
				autocomplete="new-password"
				minlength="8"
				placeholder="At least 8 characters"
				required
			/>
		</label>
		{#if fieldErrors.password}
			<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.password}</p>
		{:else}
			<p class="text-base-content/50 -mt-2 font-mono text-xs">min 8 chars</p>
		{/if}

		<button class="btn btn-primary mt-6 w-full" type="submit" disabled={submitting}>
			{submitting ? 'Setting password…' : 'Set password'}
		</button>
	</form>
{:else}
	<p class="eyebrow mb-2">Invite link</p>
	<h1 class="text-3xl tracking-tight">
		{data.tokenStatus === 'expired' ? 'Invite expired' : 'Invalid invite'}
	</h1>
	<p class="text-base-content/60 mt-3 text-sm">
		{#if data.tokenStatus === 'expired'}
			This invite link has expired. Please ask your administrator for a new one.
		{:else}
			This invite link is invalid or has already been used. Please ask your administrator for a
			new one.
		{/if}
	</p>
{/if}
