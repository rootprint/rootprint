<script lang="ts">
	import { ChartNoAxesGantt } from 'lucide-svelte';

	import { page } from '$app/state';

	import { exploreHref, type ExploreLinkFilters } from '$lib/utils/trace-params';

	type Props = {
		filters: ExploreLinkFilters;
		subject: string;
	};

	let { filters, subject }: Props = $props();

	const label = $derived(`View traces for ${subject}`);
</script>

<a
	href={exploreHref(page.url, filters)}
	class="btn btn-ghost btn-xs btn-square"
	aria-label={label}
	title={label}
>
	<ChartNoAxesGantt class="size-3" aria-hidden="true" />
</a>
