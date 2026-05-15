<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto, invalidate } from '$app/navigation';

	let { data } = $props();
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidate('app:session');
			await goto('/auth/sign-in');
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="container mx-auto p-8">
	<h1 class="text-3xl font-bold">Welcome, {data.user.name}</h1>
	<p class="mt-2 opacity-70">Signed in as {data.user.email}.</p>
	<button class="btn btn-outline mt-6" onclick={signOut} disabled={signingOut}>
		{signingOut ? 'Signing out…' : 'Sign out'}
	</button>
</div>
