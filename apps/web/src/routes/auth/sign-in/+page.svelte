<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { DEP } from '$lib/api/deps';
	import { authClient } from '$lib/auth-client';
	import { safeReturnTo } from '$lib/return-to';
	import { signInSchema } from 'api/schemas';
	import GoogleIcon from '@iconify-svelte/logos/google-icon';
	import AuthHeader from '$lib/components/auth/AuthHeader.svelte';
	import Field from '$lib/components/ui/Field.svelte';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	async function signInWithGoogle() {
		await authClient.signIn.social({
			provider: 'google',
			callbackURL: safeReturnTo(page.url.searchParams.get('returnTo'))
		});
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};
		submitting = true;
		try {
			const parsed = v.safeParse(signInSchema, { email, password });
			if (!parsed.success) {
				for (const issue of parsed.issues) {
					const key = issue.path?.[0]?.key as string | undefined;
					if (key) fieldErrors[key] = issue.message;
				}
				return;
			}

			const result = await authClient.signIn.email(parsed.output);
			if (result?.error) {
				formError = result.error.message ?? 'Sign-in failed';
				return;
			}

			await invalidate(DEP.session);
			await goto(safeReturnTo(page.url.searchParams.get('returnTo')));
		} finally {
			submitting = false;
		}
	}
</script>

<AuthHeader eyebrow="Sign in" title="Welcome back" divider />

{#if formError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError}</div>
{/if}

{#if data.providers.google.enabled}
	<button type="button" class="btn btn-outline mt-4 w-full gap-2" onclick={signInWithGoogle}>
		<GoogleIcon class="h-4 w-4" />
		Continue with Google
	</button>

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
