<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { safeReturnTo } from '$lib/return-to';
	import { signInSchema } from 'api/schemas';

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

			await invalidate('app:session');
			await goto(safeReturnTo(page.url.searchParams.get('returnTo')));
		} finally {
			submitting = false;
		}
	}
</script>

<p class="eyebrow mb-2">Sign in</p>
<h1 class="text-3xl tracking-tight">Welcome back</h1>

{#if formError}
	<div role="alert" class="alert alert-error mt-6 text-sm">{formError}</div>
{/if}

<form class="mt-6 space-y-3" {onsubmit}>
	<label class="input w-full" class:input-error={fieldErrors.email}>
		<span class="label">Email</span>
		<input
			bind:value={email}
			type="email"
			autocomplete="email"
			placeholder="you@company.com"
			required
		/>
	</label>
	{#if fieldErrors.email}
		<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.email}</p>
	{/if}

	<label class="input w-full" class:input-error={fieldErrors.password}>
		<span class="label">Password</span>
		<input
			bind:value={password}
			type="password"
			autocomplete="current-password"
			placeholder="••••••••"
			required
		/>
	</label>
	{#if fieldErrors.password}
		<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.password}</p>
	{/if}

	<button class="btn btn-primary mt-6 w-full" type="submit" disabled={submitting}>
		{submitting ? 'Signing in…' : 'Sign in'}
	</button>
</form>
