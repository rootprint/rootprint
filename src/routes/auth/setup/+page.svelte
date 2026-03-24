<script lang="ts">
	import { setupPassword } from '$lib/api/auth.remote';
	import { setupPasswordSchema } from '$lib/schemas/auth';
	import { page } from '$app/state';

	let { data } = $props();

	const token = $derived(page.url.searchParams.get('token') ?? '');
</script>

{#if data.tokenStatus === 'valid'}
	<div class="card w-full max-w-sm bg-base-100 shadow-sm">
		<div class="card-body">
			<h2 class="card-title justify-center text-2xl">Set Your Password</h2>
			<p class="text-center text-sm text-base-content/60">
				Choose a password to complete your account setup.
			</p>

			{#each setupPassword.fields.allIssues() as issue}
				<div class="alert text-sm alert-error">{issue.message}</div>
			{/each}

			<form {...setupPassword.preflight(setupPasswordSchema)} class="flex flex-col gap-4">
				<input type="hidden" name="token" value={token} />

				<label class="floating-label">
					<span>Password</span>
					<input
						{...setupPassword.fields._password.as('password')}
						class="input input-md w-full"
						placeholder="Password"
					/>
				</label>

				<button class="btn w-full btn-neutral" disabled={!!setupPassword.pending}>
					{setupPassword.pending ? 'Setting password...' : 'Set Password'}
				</button>
			</form>
		</div>
	</div>
{:else}
	<div class="card w-full max-w-sm bg-base-100 shadow-sm">
		<div class="card-body items-center text-center">
			<h2 class="card-title text-2xl">Invalid Invite</h2>
			<p class="text-sm text-base-content/60">
				{#if data.tokenStatus === 'expired_token'}
					This invite link has expired.
				{:else}
					This invite link is invalid or has already been used.
				{/if}
			</p>
			<p class="text-sm text-base-content/60">Please ask your administrator for a new invite.</p>
		</div>
	</div>
{/if}
