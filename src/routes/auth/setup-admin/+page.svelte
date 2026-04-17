<script lang="ts">
	import { setupAdmin } from '$lib/api/auth.remote';
	import { setupAdminSchema } from '$lib/schemas/auth';
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Welcome to Logwiz</h2>
		<p class="text-center text-sm text-base-content/60">
			Create the initial admin account to get started.
		</p>

		{#each setupAdmin.fields.allIssues() as issue (issue.message)}
			<div class="alert text-sm alert-error">{issue.message}</div>
		{/each}

		<form {...setupAdmin.preflight(setupAdminSchema)} class="flex flex-col gap-4">
			<label class="floating-label">
				<span>Name</span>
				<input
					{...setupAdmin.fields.name.as('text')}
					class="input input-md w-full"
					placeholder="Name"
					autocomplete="name"
				/>
			</label>

			<label class="floating-label">
				<span>Username</span>
				<input
					{...setupAdmin.fields.username.as('text')}
					class="input input-md w-full"
					placeholder="Username"
					autocomplete="username"
				/>
			</label>

			<label class="floating-label">
				<span>Email</span>
				<input
					{...setupAdmin.fields.email.as('email')}
					class="input input-md w-full"
					placeholder="Email"
					autocomplete="email"
				/>
			</label>

			<label class="floating-label">
				<span>Password</span>
				<input
					{...setupAdmin.fields._password.as('password')}
					class="input input-md w-full"
					placeholder="Password"
					autocomplete="new-password"
				/>
			</label>

			<label class="floating-label">
				<span>Confirm Password</span>
				<input
					{...setupAdmin.fields._confirmPassword.as('password')}
					class="input input-md w-full"
					placeholder="Confirm Password"
					autocomplete="new-password"
				/>
			</label>

			<button class="btn w-full btn-neutral" disabled={!!setupAdmin.pending}>
				{setupAdmin.pending ? 'Creating admin...' : 'Create Admin'}
			</button>
		</form>
	</div>
</div>
