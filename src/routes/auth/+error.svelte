<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-sm">
	<div class="card-body items-center text-center">
		<p class="text-6xl font-bold text-base-content/20">{page.status}</p>
		<h1 class="card-title">Something went wrong</h1>
		<p class="text-sm text-base-content/60">An unexpected error occurred. Please try again.</p>
		<div class="card-actions mt-2">
			<a href="/auth/sign-in" class="btn btn-neutral btn-sm">Back to sign in</a>
		</div>
	</div>
</div>
