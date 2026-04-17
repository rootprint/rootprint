<script lang="ts">
	import UserManagement from '$lib/components/admin/UserManagement.svelte';

	let { data } = $props();
</script>

<UserManagement users={data.users} />
