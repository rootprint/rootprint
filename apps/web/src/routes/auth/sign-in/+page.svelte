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
	import { KeyRound } from 'lucide-svelte';
	import type { ExternalProviderId } from 'api/types';
	import AuthHeader from '$lib/components/auth/AuthHeader.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import type { IconComponent } from '$lib/send-telemetry/types';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let pendingProvider = $state<ExternalProviderId | null>(null);
	const PROVIDERS: Record<
		ExternalProviderId,
		{ name: string; label: string; Icon: IconComponent }
	> = {
		google: { name: 'Google', label: 'Continue with Google', Icon: GoogleIcon },
		github: { name: 'GitHub', label: 'Continue with GitHub', Icon: GitHubIcon },
		oidc: { name: 'your identity provider', label: 'Continue with SSO', Icon: KeyRound }
	};
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	const returnTo = $derived(safeReturnTo(page.url.searchParams.get('returnTo')));
	const busy = $derived(submitting || pendingProvider !== null);
	const adminCreated = $derived(page.url.searchParams.get('created') === 'admin');
	const enabledProviders = $derived(
		(Object.keys(PROVIDERS) as ExternalProviderId[]).filter((id) => data.providers[id].enabled)
	);
	const externalEnabled = $derived(enabledProviders.length > 0);
	const passwordEnabled = $derived(data.providers.password.enabled);

	const OAUTH_ERROR_MESSAGES: Record<string, string> = {
		domain_not_allowed: 'Your email domain is not allowed on this instance.',
		org_not_allowed: 'Your GitHub organization is not allowed on this instance.',
		account_not_linked: 'That account could not be linked to your existing user.',
		unable_to_link_account:
			'That account could not be linked. It may already belong to another user, or its email domain may not be on this instance’s allow-list.',
		email_not_found: 'The provider did not share an email address for that account.',
		signup_disabled: 'This instance does not allow self sign-up. Ask an admin for an invitation.',
		unable_to_create_user: 'Your account could not be created on this instance.',
		// The reason is not carried through here, so do not claim revocation.
		unable_to_create_session: 'Sign-in was refused. Contact an administrator.',
		oauth_check_unavailable:
			'Could not verify your access with the provider. Try again in a minute.',
		unable_to_get_user_info:
			'Your identity provider did not return your account details. Try again or contact an administrator.',
		access_denied: 'Sign-in was cancelled.'
	};

	let interactedSinceOauthError = $state(false);

	const oauthError = $derived.by(() => {
		if (interactedSinceOauthError) return null;
		const code = page.url.searchParams.get('error');
		if (!code) return null;
		const known = Object.hasOwn(OAUTH_ERROR_MESSAGES, code)
			? OAUTH_ERROR_MESSAGES[code]
			: undefined;
		return known ?? 'Sign-in failed. Please try again or contact an admin.';
	});

	async function signInWithProvider(provider: ExternalProviderId) {
		if (busy) return;
		pendingProvider = provider;
		formError = null;
		fieldErrors = {};
		interactedSinceOauthError = true;
		const providerName = PROVIDERS[provider].name;
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
			formError = passwordEnabled
				? `Could not connect to ${providerName}. Try again or sign in with your email and password.`
				: `Could not connect to ${providerName}. Try again.`;
			pendingProvider = null;
		}
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
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

<svelte:window onpageshow={() => (pendingProvider = null)} />

{#if adminCreated}
	<AuthHeader eyebrow="Sign in" title="Administrator created">
		Your administrator account is ready. Sign in to configure Rootprint.
	</AuthHeader>
{:else}
	<AuthHeader eyebrow="Sign in" title="Welcome back" />
{/if}

{#if formError || oauthError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError ?? oauthError}</div>
{/if}

{#if externalEnabled}
	<div class="mt-6 space-y-3">
		{#each enabledProviders as id (id)}
			{@const { name, label, Icon } = PROVIDERS[id]}
			<button
				type="button"
				class="btn btn-outline w-full gap-2"
				disabled={busy}
				onclick={() => signInWithProvider(id)}
			>
				<span aria-hidden="true"><Icon class="h-4 w-4" /></span>
				{pendingProvider === id ? `Opening ${name}…` : label}
			</button>
		{/each}
	</div>
	{#if passwordEnabled}
		<div class="divider text-muted my-6 text-xs">or sign in with email</div>
	{/if}
{/if}
<p class="sr-only" role="status">
	{pendingProvider ? `Opening ${PROVIDERS[pendingProvider].name}…` : ''}
</p>
{#if passwordEnabled}
	<form class="space-y-4" class:mt-6={!externalEnabled} {onsubmit} aria-busy={busy}>
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
{/if}
