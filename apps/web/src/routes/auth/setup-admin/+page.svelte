<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { setupAdmin, AuthApiError } from '$lib/api/auth';
	import { DEP } from '$lib/api/deps';
	import { toFieldErrors } from '$lib/api/errors';
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
			await invalidate(DEP.session);
			await goto('/auth/sign-in');
		} finally {
			submitting = false;
		}
	}
</script>

<AuthHeader eyebrow="First-time setup" title="Create administrator" divider>
	This is the first account. It will have admin privileges.
</AuthHeader>

{#if formError}
	<div role="alert" class="alert alert-error mt-4 text-sm">{formError}</div>
{/if}

<form class="mt-4 space-y-3" {onsubmit}>
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
		hint="min 8 chars"
		required
	/>

	<button class="btn btn-primary mt-4 w-full" type="submit" disabled={submitting}>
		{submitting ? 'Creating…' : 'Create administrator'}
	</button>
</form>
