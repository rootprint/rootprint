<script lang="ts">
	import * as v from 'valibot';
	import { createUserSchema, type CreateUserInput } from 'api/schemas';
	import type { UserRole } from 'api/types';

	import { createUser } from '$lib/api/users';
	import { ApiError, issuesToFieldErrors, toFieldErrors } from '$lib/api/errors';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let {
		open = $bindable(false),
		onCreated
	}: {
		open: boolean;
		onCreated?: () => void | Promise<void>;
	} = $props();

	let name = $state('');
	let email = $state('');
	let role = $state<UserRole>('user');
	let inviteUrl = $state<string | null>(null);
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function reset() {
		name = '';
		email = '';
		role = 'user';
		inviteUrl = null;
		submitting = false;
		formError = null;
		fieldErrors = {};
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createUserSchema, { name, email, role });
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}
		const input: CreateUserInput = parsed.output;

		submitting = true;
		try {
			const result = await createUser(input);
			inviteUrl = result.inviteUrl;
			await onCreated?.();
		} catch (err) {
			if (inviteUrl) return;
			if (err instanceof ApiError && err.body) {
				fieldErrors = toFieldErrors(err.body);
				formError = err.message;
			} else {
				formError = err instanceof Error ? err.message : 'Failed to create user';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open title="Create user" onclose={reset}>
	{#if !inviteUrl}
		<form id="create-user-form" class="space-y-3" {onsubmit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}

			<Field
				label="Name"
				placeholder="Ada Lovelace"
				autocomplete="off"
				bind:value={name}
				error={fieldErrors.name}
				required
			/>

			<Field
				label="Email"
				type="email"
				placeholder="you@company.com"
				autocomplete="off"
				bind:value={email}
				error={fieldErrors.email}
				required
			/>

			<Field label="Role" error={fieldErrors.role}>
				{#snippet control({ id, invalid, describedBy })}
					<select
						{id}
						bind:value={role}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
						class="select w-full"
						class:select-error={invalid}
					>
						<option value="user">Member</option>
						<option value="admin">Admin</option>
					</select>
				{/snippet}
			</Field>
		</form>
	{:else}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/60 text-sm">
				Share this link with <strong>{name}</strong> to complete account setup.
			</p>
			<CopyableField value={inviteUrl} ariaLabel="Invite link" />
		</div>
	{/if}

	{#snippet actions()}
		{#if !inviteUrl}
			<button
				type="button"
				class="btn btn-ghost"
				disabled={submitting}
				onclick={() => (open = false)}
			>
				Cancel
			</button>
			<button form="create-user-form" type="submit" class="btn btn-primary" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create & get link'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		{/if}
	{/snippet}
</Modal>
