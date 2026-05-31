<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	import GoogleAuthForm from '$lib/components/admin/GoogleAuthForm.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import RemoveGoogleAuthModal from '$lib/components/admin/RemoveGoogleAuthModal.svelte';

	let { data } = $props();
	let removeOpen = $state(false);
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-12 py-12">
	<PageHeader description="Configure Google OAuth so users from approved domains can sign in.">
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1">Google authentication</h1>
			{#if data.settings.configured}
				<button
					type="button"
					class="btn btn-outline btn-sm btn-error shrink-0"
					onclick={() => (removeOpen = true)}
				>
					<Trash2 class="h-3.5 w-3.5" />
					Remove
				</button>
			{/if}
		</header>
	</PageHeader>

	<GoogleAuthForm settings={data.settings} origin={data.origin} />
</div>

<RemoveGoogleAuthModal bind:open={removeOpen} />
