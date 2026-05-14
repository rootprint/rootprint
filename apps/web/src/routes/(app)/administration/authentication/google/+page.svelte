<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';

	import GoogleAuthForm from '$lib/components/admin/GoogleAuthForm.svelte';

	let { data } = $props();
</script>

<section>
	<a
		class="mb-4 inline-flex items-center gap-1 text-sm text-base-content/60 hover:underline"
		href="/administration/authentication"
	>
		<ArrowLeft size={14} />
		Back to providers
	</a>

	<header class="mb-4">
		<h2 class="text-xl font-semibold">Google Authentication</h2>
		<p class="mt-1 text-sm text-base-content/60">
			Configure Google OAuth to allow users from specific domains to sign in.
		</p>
	</header>

	<GoogleAuthForm origin={data.origin} settings={data.settings} />
</section>
