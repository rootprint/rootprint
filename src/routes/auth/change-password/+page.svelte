<script lang="ts">
	import { changePassword } from '$lib/api/auth.remote';
	import { changePasswordSchema } from '$lib/schemas/auth';
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Change Password</h2>
		<p class="text-center text-sm text-base-content/60">
			You must set a new password before continuing.
		</p>

		{#each changePassword.fields.allIssues() as issue (issue.message)}
			<div class="alert text-sm alert-error">{issue.message}</div>
		{/each}

		<form {...changePassword.preflight(changePasswordSchema)} class="flex flex-col gap-4">
			<label class="floating-label">
				<span>New Password</span>
				<input
					{...changePassword.fields._password.as('password')}
					class="input input-md w-full"
					placeholder="New Password"
				/>
			</label>

			<label class="floating-label">
				<span>Confirm Password</span>
				<input
					{...changePassword.fields._confirmPassword.as('password')}
					class="input input-md w-full"
					placeholder="Confirm Password"
				/>
			</label>

			<button class="btn w-full btn-neutral" disabled={!!changePassword.pending}>
				{changePassword.pending ? 'Changing password...' : 'Change Password'}
			</button>
		</form>
	</div>
</div>
