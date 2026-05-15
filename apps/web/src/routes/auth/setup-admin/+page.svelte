<script lang="ts">
	import * as v from 'valibot';
	import { goto, invalidate } from '$app/navigation';
	import { setupAdminSchema, type SetupAdminInput } from '$lib/schemas/auth';
	import { ROUTES } from '$lib/constants/routes';
	import type { ApiErrorBody } from 'api/types';

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
			let input: SetupAdminInput;
			try {
				input = v.parse(setupAdminSchema, { name, email, password });
			} catch (err) {
				if (err instanceof v.ValiError) {
					for (const issue of err.issues) {
						const key = issue.path?.[0]?.key as string | undefined;
						if (key) fieldErrors[key] = issue.message;
					}
					return;
				}
				throw err;
			}

			const res = await fetch('/api/auth/setup-admin', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify(input)
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
				formError = body?.error?.message ?? `Setup failed (${res.status})`;
				for (const d of body?.error?.details ?? []) {
					if (d.path && d.path !== '(root)') fieldErrors[d.path] = d.message;
				}
				return;
			}

			await invalidate('app:session');
			await goto(ROUTES.signIn);
		} finally {
			submitting = false;
		}
	}
</script>

<h1 class="card-title text-2xl">Create administrator</h1>
<p class="text-sm opacity-70">This is the first account. It will have admin privileges.</p>

<form class="mt-6 space-y-4" {onsubmit}>
	<label class="form-control w-full">
		<span class="label-text">Name</span>
		<input
			class="input input-bordered w-full"
			class:input-error={fieldErrors.name}
			bind:value={name}
			autocomplete="name"
			required
		/>
		{#if fieldErrors.name}
			<span class="text-error text-sm mt-1">{fieldErrors.name}</span>
		{/if}
	</label>

	<label class="form-control w-full">
		<span class="label-text">Email</span>
		<input
			class="input input-bordered w-full"
			class:input-error={fieldErrors.email}
			bind:value={email}
			type="email"
			autocomplete="email"
			required
		/>
		{#if fieldErrors.email}
			<span class="text-error text-sm mt-1">{fieldErrors.email}</span>
		{/if}
	</label>

	<label class="form-control w-full">
		<span class="label-text">Password</span>
		<input
			class="input input-bordered w-full"
			class:input-error={fieldErrors.password}
			bind:value={password}
			type="password"
			autocomplete="new-password"
			minlength="8"
			required
		/>
		{#if fieldErrors.password}
			<span class="text-error text-sm mt-1">{fieldErrors.password}</span>
		{:else}
			<span class="text-sm opacity-60 mt-1">At least 8 characters.</span>
		{/if}
	</label>

	{#if formError}
		<div role="alert" class="alert alert-error">{formError}</div>
	{/if}

	<button class="btn btn-primary w-full" type="submit" disabled={submitting}>
		{submitting ? 'Creating…' : 'Create administrator'}
	</button>
</form>
