<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="bg-base-100 text-base-content flex min-h-screen items-center justify-center px-6">
	<div class="max-w-md text-center">
		<p class="text-primary text-sm tracking-wider">ERROR</p>
		<h1 class="mt-2 text-6xl tracking-tight">{page.status}</h1>
		<p class="text-base-content/60 mt-4 text-sm">
			{page.error?.message ?? 'Unexpected error'}
		</p>
		<a class="btn btn-primary mt-8" href="/">Go home</a>
	</div>
</div>
