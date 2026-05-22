<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { setupAdmin, AuthApiError } from '$lib/api/auth';
	import { toFieldErrors } from '$lib/api/errors';
	import { setupAdminSchema, type SetupAdminInput } from 'api/schemas';

	let name = $state('');
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
			const parsed = v.safeParse(setupAdminSchema, { name, email, password });
			if (!parsed.success) {
				for (const issue of parsed.issues) {
					const key = issue.path?.[0]?.key as string | undefined;
					if (key) fieldErrors[key] = issue.message;
				}
				return;
			}
			const input: SetupAdminInput = parsed.output;

			try {
				await setupAdmin(input);
			} catch (e) {
				if (e instanceof AuthApiError && e.body) {
					fieldErrors = toFieldErrors(e.body);
					formError = e.message;
				} else {
					formError = e instanceof Error ? e.message : 'Failed to create admin';
				}
				return;
			}
			await invalidate('app:session');
			await goto('/auth/sign-in');
		} finally {
			submitting = false;
		}
	}
</script>

<p class="eyebrow mb-2">First-time setup</p>
<h1 class="text-3xl tracking-tight">Create administrator</h1>
<p class="text-base-content/60 mt-2 text-sm">
	This is the first account. It will have admin privileges.
</p>

{#if formError}
	<div role="alert" class="alert alert-error mt-6 text-sm">{formError}</div>
{/if}

<form class="mt-6 space-y-3" {onsubmit}>
	<label class="input w-full" class:input-error={fieldErrors.name}>
		<span class="label">Name</span>
		<input bind:value={name} autocomplete="name" placeholder="Ada Lovelace" required />
	</label>
	{#if fieldErrors.name}
		<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.name}</p>
	{/if}

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
		{submitting ? 'Creating…' : 'Create administrator'}
	</button>
</form>
