<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';

	import GoogleAuthForm from '$lib/components/admin/GoogleAuthForm.svelte';

	let { data } = $props();
</script>

<div class="mx-auto max-w-2xl px-12 py-12">
	<a
		class="text-base-content/60 hover:text-base-content mb-6 inline-flex items-center gap-1 font-mono text-xs"
		href="/administration/authentication"
	>
		<ArrowLeft size={14} />
		Back to providers
	</a>

	<p class="eyebrow">Administration · Authentication · Google</p>
	<h1 class="mt-3 text-4xl tracking-tight">Google authentication</h1>
	<p class="text-base-content/60 mt-3 text-sm">
		Configure Google OAuth so users from approved domains can sign in.
	</p>

	<div class="hairline rounded-box mt-8 p-8">
		<GoogleAuthForm settings={data.settings} origin={data.origin} />
	</div>
</div>
