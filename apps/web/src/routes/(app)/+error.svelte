<script lang="ts">
	import { page } from '$app/state';

	const messages: Record<
		number,
		{ title: string; description: string; link: string; linkText: string }
	> = {
		401: {
			title: 'Please sign in to continue',
			description: 'You need to be signed in to access this page.',
			link: '/auth/sign-in',
			linkText: 'Go to sign in'
		},
		403: {
			title: "You don't have permission to access this page",
			description: 'Contact your administrator if you believe this is a mistake.',
			link: '/',
			linkText: 'Go home'
		},
		404: {
			title: 'Page not found',
			description: "The page you're looking for doesn't exist.",
			link: '/',
			linkText: 'Go home'
		}
	};

	const fallback = {
		title: 'Something went wrong',
		description: 'An unexpected error occurred. Please try again later.',
		link: '/',
		linkText: 'Go home'
	};

	const info = $derived(messages[page.status] ?? fallback);
</script>

<div class="flex h-full items-center justify-center">
	<div class="card w-full max-w-sm bg-base-100 shadow-sm">
		<div class="card-body items-center text-center">
			<p class="text-6xl font-bold text-base-content/20">{page.status}</p>
			<h1 class="card-title">{info.title}</h1>
			<p class="text-sm text-base-content/60">{info.description}</p>
			<div class="mt-2 card-actions">
				<a href={info.link} class="btn btn-sm btn-neutral">{info.linkText}</a>
			</div>
		</div>
	</div>
</div>
