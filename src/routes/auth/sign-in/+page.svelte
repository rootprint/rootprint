<script lang="ts">
	import Icon from '@iconify/svelte';
	import googleIcon from '@iconify-icons/logos/google-icon';

	import { page } from '$app/state';
	import { signIn } from '$lib/api/auth.remote';
	import { authClient } from '$lib/auth-client';
	import { signInSchema } from '$lib/schemas/auth';

	let { data } = $props();

	let googleLoading = $state(false);
	const returnToParam = $derived(page.url.searchParams.get('returnTo'));
	const returnTo = $derived(
		returnToParam?.startsWith('/') && !returnToParam.startsWith('//') ? returnToParam : '/'
	);

	async function handleGoogleSignIn() {
		googleLoading = true;
		await authClient.signIn.social({
			provider: 'google',
			callbackURL: returnTo,
			errorCallbackURL: '/auth/sign-in'
		});
	}

	const errorParam = $derived(page.url.searchParams.get('error'));
	const errorMessage = $derived(
		errorParam === 'domain_not_allowed'
			? 'Your email domain is not allowed to sign in.'
			: errorParam === 'unable_to_create_user'
				? 'Unable to create account. Your email domain may not be allowed.'
				: errorParam
					? 'Sign in failed. Please try again.'
					: null
	);
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Sign In</h2>

		{#if errorMessage}
			<div class="alert text-sm alert-error">{errorMessage}</div>
		{/if}

		{#each signIn.fields.allIssues() as issue (issue.message)}
			<div class="alert text-sm alert-error">{issue.message}</div>
		{/each}

		{#if data.googleAuthEnabled}
			<button
				type="button"
				class="btn w-full gap-2 btn-outline"
				disabled={googleLoading}
				onclick={handleGoogleSignIn}
			>
				{#if googleLoading}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					<Icon icon={googleIcon} class="h-4 w-4" />
				{/if}
				Sign in with Google
			</button>

			<div class="divider text-xs text-base-content/40">or</div>
		{/if}

		<form {...signIn.preflight(signInSchema)} class="flex flex-col gap-4">
			<label class="floating-label">
				<span>Email or Username</span>
				<input
					{...signIn.fields.identifier.as('text')}
					class="input input-md w-full"
					placeholder="Email or Username"
				/>
			</label>

			<label class="floating-label">
				<span>Password</span>
				<input
					{...signIn.fields._password.as('password')}
					class="input input-md w-full"
					placeholder="Password"
				/>
			</label>

			<button class="btn w-full btn-neutral" disabled={!!signIn.pending}>
				{signIn.pending ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	</div>
</div>
