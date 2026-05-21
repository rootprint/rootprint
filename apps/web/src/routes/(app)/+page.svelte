<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { authClient } from '$lib/auth-client';
	import { goto, invalidate } from '$app/navigation';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

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

<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="h-full w-full">
	<div class="mx-auto max-w-5xl px-8 py-16">
	<p class="eyebrow">Dashboard</p>
	<h1 class="mt-3 text-5xl tracking-tight">
		Welcome, <span class="text-primary">{data.session!.user.name}</span>
	</h1>
	<p class="text-base-content/60 mt-4 font-mono text-sm">
		signed in as {data.session!.user.email}
	</p>

	<div class="hairline rounded-box mt-12 p-8">
		<p class="eyebrow">Session</p>
		<dl class="mt-4 grid grid-cols-1 gap-4 font-mono text-sm sm:grid-cols-2">
			<div>
				<dt class="text-base-content/50 text-xs uppercase tracking-wider">user</dt>
				<dd class="mt-1">{data.session!.user.name}</dd>
			</div>
			<div>
				<dt class="text-base-content/50 text-xs uppercase tracking-wider">email</dt>
				<dd class="mt-1">{data.session!.user.email}</dd>
			</div>
		</dl>

		<button class="btn btn-outline btn-sm mt-8" onclick={signOut} disabled={signingOut}>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</button>
	</div>
	</div>
</OverlayScrollbarsComponent>
