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
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	const returnTo = $derived(safeReturnTo(page.url.searchParams.get('returnTo')));

	const OAUTH_ERROR_MESSAGES: Record<string, string> = {
		domain_not_allowed: 'Your email domain is not allowed on this instance.',
		org_not_allowed: 'Your GitHub organization is not allowed on this instance.',
		account_not_linked:
			'That account is not linked yet. Complete your invitation first, or contact an admin.',
		unable_to_link_account:
			'That account could not be linked. It may already belong to another user, or its email domain may not be on this instance’s allow-list.',
		email_not_found: 'The provider did not share an email address for that account.',
		signup_disabled: 'This instance does not allow self sign-up. Ask an admin for an invitation.',
		unable_to_create_user: 'Your account could not be created on this instance.',
		// The reason is not carried through here, so do not claim revocation.
		unable_to_create_session: 'Sign-in was refused. Contact an administrator.',
		access_denied: 'Sign-in was cancelled.'
	};

	let interactedSinceOauthError = $state(false);

	const oauthError = $derived.by(() => {
		if (interactedSinceOauthError) return null;
		const code = page.url.searchParams.get('error');
		if (!code) return null;
		return OAUTH_ERROR_MESSAGES[code] ?? 'Sign-in failed. Please try again or contact an admin.';
	});

	async function signInWithProvider(provider: 'google' | 'github') {
		formError = null;
		interactedSinceOauthError = true;
		const res = await authClient.signIn.social({ provider, callbackURL: returnTo });
		if (res?.error) formError = res.error.message ?? 'Sign-in failed';
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		interactedSinceOauthError = true;
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

<AuthHeader eyebrow="Sign in" title="Welcome back" divider />

{#if formError || oauthError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError ?? oauthError}</div>
{/if}

{#if data.providers.google.enabled}
	<button
		type="button"
		class="btn btn-outline mt-4 w-full gap-2"
		onclick={() => signInWithProvider('google')}
	>
		<GoogleIcon class="h-4 w-4" />
		Continue with Google
	</button>
{/if}

{#if data.providers.github.enabled}
	<button
		type="button"
		class="btn btn-outline mt-4 w-full gap-2"
		onclick={() => signInWithProvider('github')}
	>
		<GitHubIcon class="h-4 w-4" />
		Continue with GitHub
	</button>
{/if}

{#if data.providers.google.enabled || data.providers.github.enabled}
	<div class="divider my-3 text-xs opacity-60">or</div>
{/if}
<form class="mt-4 space-y-3" {onsubmit}>
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

	<button class="btn btn-primary mt-4 w-full" type="submit" disabled={submitting}>
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>
