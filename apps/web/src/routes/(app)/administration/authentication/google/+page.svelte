<script lang="ts">
	import GoogleAuthForm from '$lib/components/admin/GoogleAuthForm.svelte';

	let { data } = $props();
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">
		Administration / <a class="hover:text-base-content" href="/administration/authentication"
			>Authentication</a
		> / Google
	</p>
	<h1 class="mt-3 text-h1">Google authentication</h1>
	<p class="text-base-content/60 mt-3 text-sm">
		Configure Google OAuth so users from approved domains can sign in.
	</p>

	<div class="mt-8">
		<GoogleAuthForm settings={data.settings} origin={data.origin} />
	</div>
</div>
