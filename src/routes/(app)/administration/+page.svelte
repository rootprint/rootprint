<script lang="ts">
	import GoogleAuthCard from '$lib/components/admin/GoogleAuthCard.svelte';
	import SettingsTab from '$lib/components/admin/SettingsTab.svelte';
	import UserManagement from '$lib/components/admin/UserManagement.svelte';
	import IndexesTab from '$lib/components/index/IndexesTab.svelte';

	let { data } = $props();
	let activeTab = $state<'users' | 'indexes' | 'settings'>('users');
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
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'settings'}
				onclick={() => (activeTab = 'settings')}
			>
				Settings
			</button>
		</div>

		{#if activeTab === 'users'}
			<UserManagement users={data.users} />
			<div class="mt-6">
				<GoogleAuthCard origin={data.origin} settings={data.googleAuthSettings} />
			</div>
		{:else if activeTab === 'indexes'}
			<IndexesTab indexes={data.indexDetails} />
		{:else}
			<SettingsTab />
		{/if}
	</div>
</div>
