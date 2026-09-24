<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { setupAdmin } from '$lib/api/auth';
	import { DEP } from '$lib/api/deps';
	import { issuesToFieldErrors, toFormErrors } from '$lib/api/errors';
	import { setupAdminSchema, type SetupAdminInput } from 'api/schemas';
	import AuthHeader from '$lib/components/auth/AuthHeader.svelte';
	import Field from '$lib/components/ui/Field.svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		formError = null;
		fieldErrors = {};
		submitting = true;
		try {
			const parsed = v.safeParse(setupAdminSchema, { name, email, password });
			if (!parsed.success) {
				fieldErrors = issuesToFieldErrors(parsed.issues);
				return;
			}
			const input: SetupAdminInput = parsed.output;

			try {
				await setupAdmin(input);
			} catch (err) {
				const formErrors = toFormErrors(err, 'Failed to create admin');
				formError = formErrors.message;
				fieldErrors = formErrors.fieldErrors;
				return;
			}
			await invalidate(DEP.session);
			await goto('/auth/sign-in?created=admin');
		} finally {
			submitting = false;
		}
	}
</script>

<AuthHeader label="First-time setup" title="Create administrator">
	This first account will have admin privileges. After creating it, sign in to configure Rootprint.
</AuthHeader>

{#if formError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError}</div>
{/if}

<form class="mt-6 space-y-4" {onsubmit} aria-busy={submitting}>
	<Field
		label="Name"
		autocomplete="name"
		placeholder="Ada Lovelace"
		bind:value={name}
		error={fieldErrors.name}
		required
	/>

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
		autocomplete="new-password"
		minlength={8}
		bind:value={password}
		error={fieldErrors.password}
		hint="At least 8 characters."
		required
	/>

	<button class="btn btn-primary mt-2 w-full" type="submit" disabled={submitting}>
		{submitting ? 'Creating…' : 'Create administrator'}
	</button>
</form>
