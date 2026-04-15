<script lang="ts">
	import GoogleAuthCard from '$lib/components/admin/GoogleAuthCard.svelte';
	import UserManagement from '$lib/components/admin/UserManagement.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-6">
	<UserManagement users={data.users} />
	<GoogleAuthCard origin={data.origin} settings={data.googleAuthSettings} />
</div>
