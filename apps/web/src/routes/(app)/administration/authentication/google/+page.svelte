<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	import GoogleAuthForm from '$lib/components/admin/GoogleAuthForm.svelte';
	import RemoveGoogleAuthModal from '$lib/components/admin/RemoveGoogleAuthModal.svelte';

	let { data } = $props();
	let removeOpen = $state(false);
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-12 py-12">
	<div>
		<p class="eyebrow">
			Administration / <a class="hover:text-base-content" href="/administration/authentication"
				>Authentication</a
			> / Google
		</p>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1">Google authentication</h1>
			{#if data.settings.configured}
				<button
					type="button"
					class="btn btn-outline btn-sm btn-error shrink-0"
					onclick={() => (removeOpen = true)}
				>
					<Trash2 size={14} />
					Remove
				</button>
			{/if}
		</header>
		<p class="text-base-content/60 mt-3 text-sm">
			Configure Google OAuth so users from approved domains can sign in.
		</p>
	</div>

	<GoogleAuthForm settings={data.settings} origin={data.origin} />
</div>

<RemoveGoogleAuthModal bind:open={removeOpen} />
