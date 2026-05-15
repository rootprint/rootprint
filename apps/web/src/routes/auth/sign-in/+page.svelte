<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { signInSchema, type SignInInput } from '$lib/schemas/auth';
	import { safeReturnTo } from '$lib/constants/routes';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};
		submitting = true;
		try {
			let input: SignInInput;
			try {
				input = v.parse(signInSchema, { email, password });
			} catch (err) {
				if (err instanceof v.ValiError) {
					for (const issue of err.issues) {
						const key = issue.path?.[0]?.key as string | undefined;
						if (key) fieldErrors[key] = issue.message;
					}
					return;
				}
				throw err;
			}

			const result = await authClient.signIn.email({
				email: input.email,
				password: input.password
			});

			if (result?.error) {
				formError = result.error.message ?? 'Sign-in failed';
				return;
			}

			await invalidate('app:session');
			const returnTo = safeReturnTo(page.url.searchParams.get('returnTo'));
			await goto(returnTo);
		} finally {
			submitting = false;
		}
	}
</script>

<h1 class="card-title text-2xl">Sign in</h1>

<form class="mt-6 space-y-4" {onsubmit}>
	<label class="form-control w-full">
		<span class="label-text">Email</span>
		<input
			class="input input-bordered w-full"
			class:input-error={fieldErrors.email}
			bind:value={email}
			type="email"
			autocomplete="email"
			required
		/>
		{#if fieldErrors.email}
			<span class="text-error text-sm mt-1">{fieldErrors.email}</span>
		{/if}
	</label>

	<label class="form-control w-full">
		<span class="label-text">Password</span>
		<input
			class="input input-bordered w-full"
			class:input-error={fieldErrors.password}
			bind:value={password}
			type="password"
			autocomplete="current-password"
			required
		/>
		{#if fieldErrors.password}
			<span class="text-error text-sm mt-1">{fieldErrors.password}</span>
		{/if}
	</label>

	{#if formError}
		<div role="alert" class="alert alert-error">{formError}</div>
	{/if}

	<button class="btn btn-primary w-full" type="submit" disabled={submitting}>
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>
