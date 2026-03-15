<script lang="ts">
	import { signIn } from '$lib/api/auth.remote';
	import { signInSchema } from '$lib/schemas/auth';
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Sign In</h2>

		{#each signIn.fields.allIssues() as issue (issue.message)}
			<div class="alert text-sm alert-error">{issue.message}</div>
		{/each}

		<form {...signIn.preflight(signInSchema)} class="flex flex-col gap-4">
			<label class="floating-label">
				<span>Email or Username</span>
				<input
					{...signIn.fields.identifier.as('text')}
					class="input input-md w-full"
					placeholder="Email or Username"
				/>
			</label>

			<label class="floating-label">
				<span>Password</span>
				<input
					{...signIn.fields._password.as('password')}
					class="input input-md w-full"
					placeholder="Password"
				/>
			</label>

			<button class="btn w-full btn-neutral" disabled={!!signIn.pending}>
				{signIn.pending ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	</div>
</div>
