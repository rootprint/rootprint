<script lang="ts">
	import { signIn } from '$lib/api/auth.remote';
	import { signInSchema } from '$lib/schemas/auth';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';

	let { data } = $props();

	let googleLoading = $state(false);

	async function handleGoogleSignIn() {
		googleLoading = true;
		await authClient.signIn.social({
			provider: 'google',
			callbackURL: '/',
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
					<svg class="h-4 w-4" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
						/>
						<path
							fill="currentColor"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="currentColor"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="currentColor"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
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
