<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="hero min-h-screen bg-base-200">
	<div class="hero-content text-center">
		<div class="max-w-md">
			<h1 class="text-5xl font-bold">{page.status}</h1>
			<p class="py-4">{page.error?.message ?? 'Unexpected error'}</p>
			<a class="btn btn-primary" href="/">Go home</a>
		</div>
	</div>
</div>
