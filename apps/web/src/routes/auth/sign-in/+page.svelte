<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { DEP } from '$lib/api/deps';
	import { issuesToFieldErrors } from '$lib/api/errors';
	import { authClient } from '$lib/auth-client';
	import { safeReturnTo } from '$lib/return-to';
	import { signInSchema } from 'api/schemas';
	import GoogleIcon from '@iconify-svelte/logos/google-icon';
	import GitHubIcon from '@iconify-svelte/logos/github-icon';
	import AuthHeader from '$lib/components/auth/AuthHeader.svelte';
	import Field from '$lib/components/ui/Field.svelte';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let pendingProvider = $state<'google' | 'github' | null>(null);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	const returnTo = $derived(safeReturnTo(page.url.searchParams.get('returnTo')));
	const busy = $derived(submitting || pendingProvider !== null);
	const adminCreated = $derived(page.url.searchParams.get('created') === 'admin');

	async function signInWithProvider(provider: 'google' | 'github') {
		if (busy) return;
		pendingProvider = provider;
		formError = null;
		fieldErrors = {};
		const providerName = provider === 'google' ? 'Google' : 'GitHub';
		try {
			const result = await authClient.signIn.social({
				provider,
				callbackURL: returnTo
			});
			if (result.error || !result.data?.url) {
				formError = result.error?.message ?? `Could not sign in with ${providerName}. Try again.`;
				pendingProvider = null;
			}
		} catch {
			formError = `Could not connect to ${providerName}. Try again or sign in with your email and password.`;
			pendingProvider = null;
		}
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		formError = null;
		fieldErrors = {};
		submitting = true;
		try {
			const parsed = v.safeParse(signInSchema, { email, password });
			if (!parsed.success) {
				fieldErrors = issuesToFieldErrors(parsed.issues);
				return;
			}

			try {
				const result = await authClient.signIn.email(parsed.output);
				if (result?.error) {
					formError = result.error.message ?? 'Sign-in failed';
					return;
				}
			} catch (err) {
				formError = err instanceof Error ? err.message : 'Sign-in failed';
				return;
			}

			await invalidate(DEP.session);
			await goto(returnTo);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:window onpageshow={() => (pendingProvider = null)} />

{#if adminCreated}
	<AuthHeader eyebrow="Sign in" title="Administrator created">
		Your administrator account is ready. Sign in to configure Rootprint.
	</AuthHeader>
{:else}
	<AuthHeader eyebrow="Sign in" title="Welcome back" />
{/if}

{#if formError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError}</div>
{/if}

{#if data.providers.google.enabled || data.providers.github.enabled}
	<div class="mt-6 space-y-3">
		{#if data.providers.google.enabled}
			<button
				type="button"
				class="btn btn-outline w-full gap-2"
				disabled={busy}
				onclick={() => signInWithProvider('google')}
			>
				<GoogleIcon class="h-4 w-4" aria-hidden="true" />
				{pendingProvider === 'google' ? 'Opening Google…' : 'Continue with Google'}
			</button>
		{/if}
		{#if data.providers.github.enabled}
			<button
				type="button"
				class="btn btn-outline w-full gap-2"
				disabled={busy}
				onclick={() => signInWithProvider('github')}
			>
				<GitHubIcon class="h-4 w-4" aria-hidden="true" />
				{pendingProvider === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
			</button>
		{/if}
	</div>
	<div class="divider text-muted my-6 text-xs">or sign in with email</div>
{/if}
<p class="sr-only" role="status">
	{pendingProvider === 'google'
		? 'Opening Google…'
		: pendingProvider === 'github'
			? 'Opening GitHub…'
			: ''}
</p>
<form
	class="space-y-4"
	class:mt-6={!data.providers.google.enabled && !data.providers.github.enabled}
	{onsubmit}
	aria-busy={busy}
>
	<Field
		label="Email"
		type="email"
		autocomplete="email"
		placeholder="you@company.com"
		bind:value={email}
		error={fieldErrors.email}
		required
	/>

	<Field
		label="Password"
		type="password"
		autocomplete="current-password"
		bind:value={password}
		error={fieldErrors.password}
		required
	/>

	<button class="btn btn-primary mt-2 w-full" type="submit" disabled={busy}>
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>
