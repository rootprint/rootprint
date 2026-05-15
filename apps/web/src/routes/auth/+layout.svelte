<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen bg-base-200 flex items-center justify-center px-4 py-8">
	<div class="card w-full max-w-md bg-base-100 shadow-xl">
		<div class="card-body">
			{@render children?.()}
		</div>
	</div>
</div>
