<script lang="ts">
	import type { ComponentStatus } from 'api/types';

	type Props = {
		status: ComponentStatus | 'unknown';
		label?: string;
	};

	let { status, label }: Props = $props();

	const tone = $derived(
		status === 'ok'
			? 'bg-primary'
			: status === 'degraded'
				? 'bg-warning'
				: status === 'down'
					? 'bg-error'
					: 'bg-base-content/30'
	);

	const a11y = $derived(label ?? status);
</script>

<span role="img" aria-label={a11y} class="inline-block size-1.5 rounded-full {tone}"></span>
