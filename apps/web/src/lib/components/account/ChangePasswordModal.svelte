<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as v from 'valibot';
	import { issuesToFieldErrors } from '$lib/api/errors';
	import Field from '$lib/components/ui/Field.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { authClient } from '$lib/auth-client';

	const changePasswordSchema = v.pipe(
		v.object({
			currentPassword: v.pipe(v.string(), v.minLength(1, 'Current password is required.')),
			newPassword: v.pipe(
				v.string(),
				v.minLength(8, 'New password must be at least 8 characters.'),
				v.maxLength(128, 'New password must be at most 128 characters.')
			),
			confirmPassword: v.string()
		}),
		v.forward(
			v.partialCheck(
				[['newPassword'], ['confirmPassword']],
				(input) => input.newPassword === input.confirmPassword,
				'New passwords do not match.'
			),
			['confirmPassword']
		)
	);

	let { open = $bindable(false) }: { open: boolean } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function reset() {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
		submitting = false;
		formError = null;
		fieldErrors = {};
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(changePasswordSchema, {
			currentPassword,
			newPassword,
			confirmPassword
		});
		if (!parsed.success) {
			fieldErrors = issuesToFieldErrors(parsed.issues);
			return;
		}

		submitting = true;
		try {
			const result = await authClient.changePassword({
				currentPassword: parsed.output.currentPassword,
				newPassword: parsed.output.newPassword,
				revokeOtherSessions: true
			});
			if (result?.error) {
				formError = result.error.message ?? 'Failed to change password.';
				return;
			}
			toast.success('Password changed');
			open = false;
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Failed to change password.';
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	bind:open
	title="Change password"
	onclose={reset}
	oncancel={(e) => {
		if (submitting) e.preventDefault();
	}}
>
	<form id="change-password-form" class="flex flex-col gap-3" {onsubmit}>
		{#if formError}
			<div role="alert" class="alert alert-error text-sm">{formError}</div>
		{/if}
		<Field
			label="Current password"
			type="password"
			autocomplete="current-password"
			bind:value={currentPassword}
			error={fieldErrors.currentPassword}
			required
		/>
		<Field
			label="New password"
			type="password"
			autocomplete="new-password"
			bind:value={newPassword}
			error={fieldErrors.newPassword}
			required
		/>
		<Field
			label="Confirm new password"
			type="password"
			autocomplete="new-password"
			bind:value={confirmPassword}
			error={fieldErrors.confirmPassword}
			required
		/>
	</form>

	{#snippet actions()}
		<button
			type="button"
			class="btn btn-ghost"
			disabled={submitting}
			onclick={() => (open = false)}
		>
			Cancel
		</button>
		<button type="submit" form="change-password-form" class="btn btn-primary" disabled={submitting}>
			{submitting ? 'Saving…' : 'Change password'}
		</button>
	{/snippet}
</Modal>
