<script lang="ts">
	import { page } from '$app/state';

	const info = $derived(
		page.status === 404
			? { title: 'Page not found', description: "The page you're looking for doesn't exist." }
			: {
					title: 'Something went wrong',
					description: 'An unexpected error occurred. Please try again later.'
				}
	);
</script>

<div class="flex min-h-screen items-center justify-center bg-base-200">
	<div class="card w-full max-w-sm bg-base-100 shadow-sm">
		<div class="card-body items-center text-center">
			<p class="text-6xl font-bold text-base-content/20">{page.status}</p>
			<h1 class="card-title">{info.title}</h1>
			<p class="text-sm text-base-content/60">{info.description}</p>
			<div class="mt-2 card-actions">
				<a href="/" class="btn btn-sm btn-neutral">Go home</a>
			</div>
		</div>
	</div>
</div>
