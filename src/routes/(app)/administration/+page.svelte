<script lang="ts">
	import UserManagement from '$lib/components/UserManagement.svelte';
	import IndexesTab from '$lib/components/IndexesTab.svelte';

	let { data } = $props();
	let activeTab = $state<'users' | 'indexes'>('users');
</script>

<div class="h-full overflow-y-auto align-middle">
	<div class="mx-auto max-w-6xl px-4 py-8">
		<div class="flex items-center justify-between py-4">
			<div>
				<h2 class="text-xl font-semibold">Administration</h2>
				<p class="text-sm text-base-content/60">Manage your Logwiz instance configuration</p>
			</div>
		</div>

		<div role="tablist" class="tabs-border mb-6 tabs">
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'users'}
				onclick={() => (activeTab = 'users')}
			>
				Users
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'indexes'}
				onclick={() => (activeTab = 'indexes')}
			>
				Indexes
			</button>
		</div>

		{#if activeTab === 'users'}
			<UserManagement users={data.users} />
		{:else}
			<IndexesTab indexes={data.indexSummaries} />
		{/if}
	</div>
</div>
