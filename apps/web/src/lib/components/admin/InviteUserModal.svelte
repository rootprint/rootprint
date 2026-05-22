<script lang="ts">
	import * as v from 'valibot';
	import { createInviteSchema, type CreateInviteInput } from 'api/schemas';
	import type { UserRole } from 'api/types';

	import { createInvite, InviteApiError } from '$lib/api/invites';
	import { toFieldErrors } from '$lib/api/errors';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let {
		open = $bindable(false),
		oncreated
	}: {
		open: boolean;
		oncreated?: () => void | Promise<void>;
	} = $props();

	let phase = $state<'form' | 'reveal'>('form');
	let name = $state('');
	let email = $state('');
	let role = $state<UserRole>('user');
	let inviteUrl = $state('');
	let submitting = $state(false);
	let formError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string>>({});

	function reset() {
		phase = 'form';
		name = '';
		email = '';
		role = 'user';
		inviteUrl = '';
		submitting = false;
		formError = null;
		fieldErrors = {};
	}

	function handleClose() {
		reset();
	}

	async function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = null;
		fieldErrors = {};

		const parsed = v.safeParse(createInviteSchema, { name, email, role });
		if (!parsed.success) {
			for (const issue of parsed.issues) {
				const key = issue.path?.[0]?.key as string | undefined;
				if (key) fieldErrors[key] = issue.message;
			}
			return;
		}
		const input: CreateInviteInput = parsed.output;

		submitting = true;
		try {
			const result = await createInvite(input);
			inviteUrl = result.inviteUrl;
			phase = 'reveal';
			await oncreated?.();
		} catch (e) {
			if (e instanceof InviteApiError && e.body) {
				fieldErrors = toFieldErrors(e.body);
				formError = e.message;
			} else {
				formError = e instanceof Error ? e.message : 'Failed to create invite';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Modal bind:open title="Invite user" onclose={handleClose}>
	{#if phase === 'form'}
		<form class="flex flex-col gap-4" {onsubmit}>
			{#if formError}
				<div role="alert" class="alert alert-error text-sm">{formError}</div>
			{/if}

			<label class="input w-full" class:input-error={fieldErrors.name}>
				<span class="label">Name</span>
				<input bind:value={name} placeholder="Ada Lovelace" autocomplete="off" required />
			</label>
			{#if fieldErrors.name}
				<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.name}</p>
			{/if}

			<label class="input w-full" class:input-error={fieldErrors.email}>
				<span class="label">Email</span>
				<input
					bind:value={email}
					type="email"
					placeholder="ada@company.com"
					autocomplete="off"
					required
				/>
			</label>
			{#if fieldErrors.email}
				<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.email}</p>
			{/if}

			<label class="select w-full" class:select-error={fieldErrors.role}>
				<span class="label">Role</span>
				<select bind:value={role}>
					<option value="user">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			{#if fieldErrors.role}
				<p class="text-error -mt-2 font-mono text-xs">{fieldErrors.role}</p>
			{/if}

			<div class="modal-action">
				<button
					type="button"
					class="btn btn-ghost"
					disabled={submitting}
					onclick={() => (open = false)}
				>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{submitting ? 'Creating…' : 'Create & get link'}
				</button>
			</div>
		</form>
	{:else}
		<div class="flex flex-col gap-3">
			<p class="text-base-content/70 text-sm">
				Share this link with <strong>{name}</strong> to complete account setup.
			</p>
			<CopyableField value={inviteUrl} ariaLabel="Invite link" />
		</div>
		<div class="modal-action">
			<button type="button" class="btn btn-primary" onclick={() => (open = false)}>Done</button>
		</div>
	{/if}
</Modal>
