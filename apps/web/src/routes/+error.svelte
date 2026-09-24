<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="bg-base-100 text-base-content flex min-h-screen items-center justify-center px-6">
	<div class="max-w-md text-center">
		<p class="section-label">Error</p>
		<h1 class="text-display mt-2">{page.status}</h1>
		<p class="text-muted mt-4 text-sm">
			{page.error?.message ?? 'Unexpected error'}
		</p>
		<a class="btn btn-primary mt-8" href="/">Go home</a>
	</div>
</div>
